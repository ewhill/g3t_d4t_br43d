BTN_CHECKOUT_SELECTOR = "button[data-tl-id='CartCheckOutBtnBottom']"

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
  console.log("CHECKOUT_WALMART_BB! ;S");
  
  function done() {
    // Noop 'finally()'.
    console.log("checkout.js: Done.");
  }
  
  waitAndClick({
    selector: BTN_CHECKOUT_SELECTOR, 
    callback: (err, el) => {
      if(err) {
        chrome.runtime.sendMessage({
            status: false,
            type: "checkout_err",
            message: err.message,
            stack: err.stack
          },
          done);
        return;
      }
      
      chrome.runtime.sendMessage({
          type: "checkout_ok",
          selector: BTN_CHECKOUT_SELECTOR
        },
        done);
    },
    backoff: 100,
    maxBackoff: 5000
  });
})();