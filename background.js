const getActiveTabId = () => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({
      active: true,
      currentWindow: true
    }, (tabs) => {
      console.log(tabs);
      if(!tabs || !tabs.length) {
        return reject(new Error("Could not get active tab."));
      }
      return resolve(tabs[0].id);
    });
  });
};

const navigateTabTo = (tabId, url, urlValidation, timeout=10000) => {
  if(!urlValidation) {
    urlValidation = url;
  }
  
  return new Promise((resolve, reject) => {
    let navigationTimeout;
    
    function internalCb(changedTabId, changeInfo, tab) {
      let isUrlEqual = false;
      if(typeof urlValidation === "string") {
        isUrlEqual = (tab.url === urlValidation);
      } else if(urlValidation instanceof RegExp) {
        isUrlEqual = urlValidation.test(tab.url);
      }
      
      if(changedTabId === tabId && isUrlEqual && changeInfo.status == 'complete') {
        console.log(`Navigation successful.`);
        clearTimeout(navigationTimeout);
        chrome.tabs.onUpdated.removeListener(internalCb);
        return resolve();
      }
    }
      
    navigationTimeout = setTimeout(() => {
      console.error(`Failed to navigate to ${url}!`);
      chrome.tabs.onUpdated.removeListener(internalCb);
      return reject();
    }, timeout);
    
    console.log(`Registering navigation listener...`);
    chrome.tabs.onUpdated.addListener(internalCb);
      
    console.log(`Navigating to ${url}...`);
    chrome.tabs.update(tabId, { url });
  });
};

const runScriptInTab = (tabId, script) => {
  return new Promise((resolve) => {
    chrome.tabs.executeScript(
      tabId,
      { file: script, runAt: "document_start" },
      (result) => {
        console.log(`Script execution complete!`);
        console.log(result);
        return resolve();
      });
  });
};

class runtime {
  constructor() {
    this._currentCheckoutAttempts = 0;
    this._currentFulfillmentAttempts = 0;
    this._currentProductAttempts = 0;
    this._currentProductUrl = null;
    this._isRunning = false;
    this._maxCheckoutAttempts = 5;
    this._maxFulfillmentAttempts = 10;
    this._maxProductAttempts = 5;
    this._message_handlers = {};
    this._runningUrls = [];
    this._runPromise = null;
    this._runPromiseResolve = null;
    this._runPromiseReject = null;
    this._tabId = null;
    
    chrome.runtime.onInstalled.addListener(() => {
      chrome.tabs.onUpdated.addListener(
        (tabId, changeInfo, tab) => {
          this._defaultTabsOnUpdated(tabId, changeInfo, tab);
        });
      chrome.runtime.onMessage.addListener(
        (request, sender, sendResponse) => {
          this._handleMessage(request, sender, sendResponse);
          return true; // Return true to keep message channel open.
        });
      
      // The following messages come from popup script.
      this.addMessageHandler("getall", this._handleGetAllRequest.bind(this));
      this.addMessageHandler("add", this._handleAddRequest.bind(this));
      this.addMessageHandler("remove", this._handleRemoveRequest.bind(this));
      this.addMessageHandler("go", this._handleGoRequest.bind(this));
      
      // The following messages come from content script(s).
      this.addMessageHandler("add_to_cart_ok", this._handleAddToCartOkRequest.bind(this));
      this.addMessageHandler("add_to_cart_err", this._handleAddToCartErrRequest.bind(this));
      this.addMessageHandler("checkout_ok", this._handleCheckoutOkRequest.bind(this));
      this.addMessageHandler("checkout_err", this._handleCheckoutErrRequest.bind(this));
      this.addMessageHandler("fulfillment_ok", this._handleFulfillmentOkRequest.bind(this));
      this.addMessageHandler("fulfillment_err", this._handleFulfillmentErrRequest.bind(this));
    });
  }
  
  _defaultTabsOnUpdated(tabId, changeInfo, tab) {
    const walmartRegex = /https?:\/\/(www\.)?walmart\.com\/?(.*)/ig;
    if(changeInfo.status === 'complete') {
      if(walmartRegex.test(tab.url)) {
        console.log("We @ walmart bb! ;)");
        chrome.browserAction.setBadgeText({text: 'RDY'});
        chrome.browserAction.setBadgeBackgroundColor({color: '#ff8825'});
      } else {
        chrome.browserAction.setBadgeText({text: '---'});
        chrome.browserAction.setBadgeBackgroundColor({color: '#999999'});
      }
    } 
  }
  
  addMessageHandler(type, handler) {
    if(typeof type === 'string' && typeof handler === 'function') {
      this._message_handlers[type] = handler;
    } else {
      throw new Error("Invalid arguments for 'addMessageHandler'!");
    }
  }
  
  _handleMessage(request, sender, sendResponse) {
    console.log(sender.tab ?
                "From a content script:" + sender.tab.url :
                "From the extension");
    
    if(!request.hasOwnProperty("type")) {
      return true;
    }
    
    const type = request.type.toLowerCase();
    if(this._message_handlers.hasOwnProperty(type)) {
      console.log(`Processing request: ${type}.`);
      return this._message_handlers[type](request, sender, sendResponse);
    }
    
    console.warn(`Received message of type ${type} but no handler with ` +
      `the given type is registered.`);
  }
  
  _checkRequestHasUrl(request) {
    return (request && request.hasOwnProperty("url") && request.url.length > 0);
  }
  
  _getUrlsFromStorage() {
    console.log(`Getting URLs from storage...`);
    return new Promise((resolve) => {
      chrome.storage.local.get(['urls'], (result) => {
        console.log(`URLs successfully retrieved.`);
        const { urls=[] } = result;
        return resolve(urls);
      });
    });
  }
  
  _addUrlToStorage(url) {
    console.log(`Getting URLs from storage...`);
    return this._getUrlsFromStorage()
      .then(urls => {
        console.log(`Adding URL...`);
        urls.push(url);
        
        return new Promise((resolve) => {
          console.log(`Updating URLs to storage...`);
          chrome.storage.local.set({ urls }, () => {
            console.log(`URLs successfully updated.`);
            return resolve(urls);
          });
        });
      });
  }
  
  _removeUrlFromStorage(url) {
    console.log(`Getting URLs from storage...`);
    return this._getUrlsFromStorage()
      .then(urls => {
        console.log(`Removing URL...`);
        const idx = urls.indexOf(url);
        if(idx > -1) {
          urls.splice(idx, 1);
        }
        return new Promise((resolve) => {
          console.log(`Updating URLs to storage...`);
          chrome.storage.local.set({ urls }, () => {
            console.log(`URLs successfully updated.`);
            return resolve(urls);
          });
        });
      });
  }
  
  _addNextToCart() {
    return new Promise((resolve) => {
      const [ url=null ] = this._runningUrls.splice(0,1);
      this._currentProductUrl = url;
      
      return navigateTabTo(this._tabId, url)
        .then(() => {
          return runScriptInTab(this._tabId, "addToCart.js");
        });
    });
  }
  
  _checkout() {
    return navigateTabTo(this._tabId, "https://www.walmart.com/cart")
      .then(() => {
        console.log("In cart. Let's checkout...");
        return runScriptInTab(this._tabId, "checkout.js");
      });
  }
  
  _fulfill() {
    return navigateTabTo(this._tabId, "https://www.walmart.com/checkout/#/fulfillment")
      .then(() => {
        return runScriptInTab(this._tabId, "fulfillment.js");
      });
  }
  
  _goCleanup() {
    this._currentCheckoutAttempts = 0;
    this._currentFulfillmentAttempts = 0;
    this._currentProductAttempts = 0;
    this._currentProductUrl = null;
    this._isRunning = false;
    this._runningUrls = [];
    this._runPromise = null;
    this._runPromiseResolve = null;
    this._runPromiseReject = null;
    this._tabId = null;
  }
  
  _go() {
    if(this._isRunning) {
      return this._runPromise;
    }
    
    return this._getUrlsFromStorage()
      .then(urls => {
        this._runningUrls = urls;
        return getActiveTabId();
      })
      .then(tabId => {
        this._tabId = tabId;
        this._isRunning = true;
        
        this._runPromise = new Promise((resolve, reject) => {
          this._runPromiseResolve = resolve;
          this._runPromiseReject = reject;
        });
        
        // Start the sequence...
        this._addNextToCart();
        return this._runPromise;
      });
  }
  
  _handleGetAllRequest(request, sender, sendResponse) {
    console.log(`Handling getall request...`);
    this._getUrlsFromStorage()
      .then(urls => {
        console.log(`Sending URLs to client...`);
        sendResponse({ status: true, urls });
      });
  }
  
  _handleAddRequest(request, sender, sendResponse) {
    console.log(`Handling add request...`);
    if(!this._checkRequestHasUrl(request)) {
      console.error(`Invalid add request!`);
      sendResponse({ status: false });
    } else {
      console.log(`Invoking add method...`);
      this._addUrlToStorage(request.url)
        .then(urls => {
          console.log(`Sending URLs to client...`);
          sendResponse({ status: true, urls });
        });
    }
  }
  
  _handleRemoveRequest(request, sender, sendResponse) {
    console.log(`Handling remove request...`);
    if(!this._checkRequestHasUrl(request)) {
      console.error(`Invalid remove request!`);
      sendResponse({ status: false });
    } else {
      console.log(`Invoking remove method...`);
      this._removeUrlFromStorage(request.url)
        .then(urls => {
          console.log(`Sending URLs to client...`);
          sendResponse({ status: true, urls });
        });
    }
  }
  
  
  // ----------------------------------------------
  // ----- Here be checkout workflow requests -----
  // ----------------------------------------------
  
  _handleGoRequest(request, sender, sendResponse) {
    return this._go()
      .then(() => {
        sendResponse({ status: true });
      })
      .catch(err => {
        sendResponse({ status: false, message: err.message });
      });
  }
  
  _handleAddToCartOkRequest(request, sender, sendResponse) {
    console.log(`Product successfully added to cart!`);
    sendResponse({ status: true });
    
    if(this._runningUrls.length > 0) {
      return this._addNextToCart();
    }
    
    return this._checkout();
  }
  
  _handleAddToCartErrRequest(request, sender, sendResponse) {
    console.error("Failed to add product to cart!");
    console.error(request);
    sendResponse({ status: true });
    
    if(this._currentProductAttempts >= this._maxProductAttempts) {
      const err = new Error(`Max add to cart attempts exceeded!`);
      this._runPromiseReject(err);
      this._goCleanup();
      return Promise.reject(err);
    }
    
    // Try again (add product back to urls)...
    console.log(`Attempting to add product again (try ` + 
      `${this._currentProductAttempts} out of ` + 
      `${this._maxProductAttempts} max).`);
    this._runningUrls.unshift(this._currentProductUrl);
    this._currentProductAttempts++;
    return this._addNextToCart();
  }
  
  _handleCheckoutOkRequest(request, sender, sendResponse) {
    sendResponse({ status: true });
    console.log("Checkout completed; moving to fulfillment.");
    
    return this._fulfill();
  }
  
  _handleCheckoutErrRequest(request, sender, sendResponse) {
    console.error("Failed to start checkout!");
    console.error(request);
    sendResponse({ status: true });
    
    if(this._currentCheckoutAttempts >= this._maxCheckoutAttempts) {
      const err = new Error(`Max checkout attempts exceeded!`);
      this._runPromiseReject(err);
      this._goCleanup();
      return Promise.reject(err);
    }
    
    // Try again...
    console.log(`Attempting to checkout again (try ` + 
      `${this._currentCheckoutAttempts} out of ` + 
      `${this._maxCheckoutAttempts} max).`);
    this._currentCheckoutAttempts++;
    return this._checkout();
  }
  
  _handleFulfillmentOkRequest(request, sender, sendResponse) {
    this._runPromiseResolve();
    this._goCleanup();
    
    sendResponse({ status: true });
    console.log("Fulfillment complete!");
    alert("Done -- check it out??");
  }
  
  _handleFulfillmentErrRequest(request, sender, sendResponse) {
    console.error("Failed to complete fulfillment!");
    console.error(request);
    sendResponse({ status: true });
    
    if(this._currentFulfillmentAttempts >= this._maxFulfillmentAttempts) {
      const err = new Error(`Max fulfillment attempts exceeded!`);
      this._runPromiseReject(err);
      this._goCleanup();
      return Promise.reject(err);
    }
    
    // Try again...
    console.log(`Attempting to complete fullfillment again (try ` + 
      `${this._currentFulfillmentAttempts} out of ` + 
      `${this._maxFulfillmentAttempts} max).`);
    this._currentFulfillmentAttempts++;
    return this._fulfill();
  }
}

new runtime();