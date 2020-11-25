
BTN_ADD_TO_CART_SELECTOR="button[data-tl-id='ProductPrimaryCTA-cta_add_to_cart_button']";

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

(function main() {
  console.log("ADD_TO_CART_WALMART_BB! xD");
  
  function done(response) {
    console.log("addToCart.js: Done.");
  }
  
  waitAndClick({
    selector: BTN_ADD_TO_CART_SELECTOR, 
    callback: (err, el) => {
      if(err) {
        chrome.runtime.sendMessage({
            status: false,
            type: "add_to_cart_err",
            message: err.message,
            stack: err.stack
          },
          done);
        return;
      }
      
      chrome.runtime.sendMessage({
          type: "add_to_cart_ok",
          selector: BTN_ADD_TO_CART_SELECTOR
        },
        done);
    },
    backoff: 100, // Start at 100ms delay.
    maxBackoff: 3500 // Only wait 5s before failing.
  });
})();