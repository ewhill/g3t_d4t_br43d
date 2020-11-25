

NO_RESPONSE = {
  status: true,
  message: "No response received. Proceeding with caution."
};

function checkResponseStatus(response) {
  if(!response || typeof response.status !== 'boolean' || !response.status) {
    alert(`Error from background: ${response.message}`);
  }
}

function updateUrlsList(urls) {
  const urlsEl = document.getElementById("urls");
  urlsEl.innerHTML = "";
  for(let url of urls) {
    const listItemEl = document.createElement("li");
    
    const itemAnchorEl = document.createElement("a");
    itemAnchorEl.innerText = url;
    itemAnchorEl.href = url;
    itemAnchorEl.target = "_blank";
    listItemEl.appendChild(itemAnchorEl);
    
    const removeAnchorEl = document.createElement("a");
    removeAnchorEl.innerText = "X";
    removeAnchorEl.href = "#";
    removeAnchorEl.addEventListener("click", () => { remove(url); });
    listItemEl.appendChild(removeAnchorEl);
    
    urlsEl.appendChild(listItemEl);
  }
}

function getAll() {
  chrome.runtime.sendMessage({ type: "getall" }, handleGetAllResponse);
}

function handleGetAllResponse(response=NO_RESPONSE) {
  checkResponseStatus(response);
  const { urls=[] } = response;
  updateUrlsList(urls);
}

function add() {
  const urlEl = document.getElementById('url');
  const url = urlEl.value;
  chrome.runtime.sendMessage({ type: "add", url }, handleAddResponse);
}

function handleAddResponse(response=NO_RESPONSE) {
  checkResponseStatus(response);
  const { urls=[] } = response;
  updateUrlsList(urls);
}

function remove(url) {
  chrome.runtime.sendMessage({ type: "remove", url }, handleRemoveResponse);
}

function handleRemoveResponse(response=NO_RESPONSE) {
  checkResponseStatus(response);
  const { urls=[] } = response;
  updateUrlsList(urls);
}

function go() {
  chrome.runtime.sendMessage({ type: "go" }, handleGoResponse);
}

function handleGoResponse(response=NO_RESPONSE) {
  checkResponseStatus(response);
  console.log(response);
}


window.addEventListener("DOMContentLoaded", function(event) {
  document.getElementById("frm").onsubmit = () => {
    add();
    return false;
  };
  
  document.getElementById("go").onclick = go;
  
  getAll();
});