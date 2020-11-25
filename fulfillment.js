
BTN_FULFILLMENT_SELECTOR = "button[data-automation-id='fulfillment-continue']";
BTN_ADDRESS_SELECTOR = "button[data-automation-id='address-book-action-buttons-on-continue']";
BTN_SUBMIT_SELECTOR = "button[data-automation-id='submit-payment-cc']";

function waitForEl({
  selector,
  callback=()=>{},
  backoff=1000,
  maxBackoff=-1
}) {
  if(!selector || selector.length === 0) {
    return callback(
      new Error(`Must provide a valid selector.`), null);
  }
  
  if(maxBackoff > -1 && backoff >= maxBackoff) {
    return callback(
      new Error(
        `Timeout occured while looking for element with selector '${selector}'.`), 
      null);
  }
  
  console.log(`Searching for element by '${selector}'...`);
  const [ el=null ] = document.querySelectorAll(selector);
  
  if(el) {
    return callback(null, el);
  } else {
    console.log(`Element not found (yet); ` +
      `Looking again in ${backoff} ms...`);
    setTimeout(() => {
      return waitForEl({
        selector,
        callback,
        backoff: backoff*1.5,
        maxBackoff
      });
    }, backoff);
  }
}

function waitAndClick({
  selector,
  callback=()=>{},
  backoff=1000,
  maxBackoff=-1
}) {
  return waitForEl({
    selector,
    callback: (err, el) => {
      if(err) {
        return callback(err, el);
      }
      
      console.log("Clicking element...");
      el.click();
      return callback(err, el);
    },
    backoff,
    maxBackoff
  });
}

function waitAndFill({
  selector,
  value,
  callback=()=>{},
  backoff=1000,
  maxBackoff=-1
}) {
  return waitForEl({
    selector,
    callback: (err, el) => {
      if(err) {
        return callback(err, el);
      }
      
      console.log("Filling element...");
      el.dispatchEvent(new Event("input"));
      el.value = value;
      return callback(err, el);
    },
    backoff,
    maxBackoff
  });
}


(function main() {
  console.log("FULFILL_WALMART_BB! ;S");
  
  function fail(err) {
    chrome.runtime.sendMessage({
      status: false,
      type: "fulfillment_err",
      message: err.message,
      stack: err.stack
    },
    done);
  }
  
  function done(response) {
    console.log("fulfillment.js: Done."); 
  }
  
  waitAndClick({
    selector: BTN_FULFILLMENT_SELECTOR,
    callback: (err, el) => {
      if(err) {
        return fail(err);
      }
      
      waitAndClick({
        selector: BTN_ADDRESS_SELECTOR,
        callback: (err, el) => {
          if(err) {
            return fail(err);
          }
          
          waitAndFill({
            selector: "input[title='cvv']",
            value: "123",
            callback: (err, el) => {
              if(err) {
                return fail(err);
              }
              
              waitAndClick({
                selector: BTN_SUBMIT_SELECTOR,
                callback: () => {
                  if(err) {
                    return fail(err);
                  }
                  
                  chrome.runtime.sendMessage({ type: "fulfillment_ok" }, done);
                }
              });
            },
            backoff: 1000,
            maxBackoff: 20000
          });
        },
        backoff: 1000,
        maxBackoff: 20000
      });
    },
    backoff: 1000,
    maxBackoff: 20000
  });
})();