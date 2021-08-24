import {
  firebaseConfig,
  userSignOut,
  readDB,
  writeDB,
  removeDB,
  addChlidDB,
  pushKey,
  setDBListener
} from "./modules/firebase.js";
import { checkUserPresent } from "./modules/util.js";

// firebase initialization
firebase.initializeApp(firebaseConfig);
firebase.analytics();

const auth = firebase.auth();
const database = firebase.database();
let user,
  namesList = [],
  uidList = [],
  friendlist = null,
  friendsUID = [];

// selector
const userProfilePic = document.querySelector(".header__img");
const userName = document.querySelector(".header__title--username");

//update profile and name
function updateUserDetails() {
  userProfilePic.src = user.photoURL;
  userName.innerText = user.displayName;
}

//Update names and uid list
function appendList(data) {
  uidList.push(data.key);
  namesList.push(data.val());
}

// sign In status change
auth.onAuthStateChanged(async (check_user) => {
  if (check_user) {
    // check user redirected directly
    let check_presence = await readDB(database, `users/${check_user.uid}`);
    if (!check_presence.val()) {
      window.location = "./sign_in.html";
    }
    // update on sign in
    user = check_user;
    await updateFriendList();
    addDbListener();
    console.log(user);
    updateUserDetails();
  } else {
    window.location = "./sign_in.html";
  }
});

// listener
userProfilePic.addEventListener("click", () => {
  userSignOut(auth);
});

// ------------------------------------------------------ friends js start ------------------------------------------------------

//selector
let searchInp = document.querySelector(".main__input");
let searchCnt = document.querySelector(".main__chat");
let addBtn;

//remove from search result after add btn triggered
function removeSerachFriendResult(e) {
  let remove_elem = document.querySelector(
    `.main__result-card[data-id=${e.target.parentElement.dataset.id}]`
  );
  console.log(remove_elem);
  searchCnt.removeChild(remove_elem);
}

// Update search Result
function updateSearchResult(uid) {
  // check for not resending the request
  if(user.uid === uid || checkUserPresent(friendlist, friendsUID, uid)) return;
  let search_user = namesList[uidList.findIndex((tot_uid) => tot_uid === uid)];
  return `<div class="main__result-card" data-id=${uid}>
                            <img
                              src=${search_user.photo}
                              alt="Friend"
                              class="main__img"
                            />
                            <p class="main__friend-name">${search_user.name}</p>
                            <button class="main__add-friend">Add</button>
                          </div>`;
}

// update Friends list
async function sendRequest(uid) {
  // check for not resending the request
  await updateFriendList();
  if(checkUserPresent(friendlist, friendsUID, uid)) return;
  let userUpdate = {},
    friendUpdate = {};
  userUpdate[uid] = "pending";
  friendUpdate[user.uid] = user.displayName;
  addChlidDB(database, `friends/${user.uid}/sent`, uid, "pending");
  addChlidDB(database, `friends/${uid}/received`, user.uid, "pending");
}

// add and remove friend
async function addFriend(e) {
  await updateFriendList();
  let fid = e.target.parentElement.dataset.id;
  let hashtext = CryptoJS.SHA256(fid + user.uid).toString();
  addChlidDB(database, `friends/${user.uid}/friends`, fid, hashtext);
  addChlidDB(database, `friends/${fid}/friends`, user.uid, hashtext);
  removeDB(database, `friends/${user.uid}/received/${fid}`);
  removeDB(database, `friends/${fid}/sent/${user.uid}`);
  let value = {
    user: {
      user1: user.uid,
      user2: fid,
    },
  };
  writeDB(database, `chat/${hashtext}`, value);
}

async function rejectFriend(e){
  let fid = e.target.parentElement.dataset.id;
  let key = pushKey(database, `friends/${fid}`, "notifications");
  console.log(key)
  let notification = {
    0: namesList[uidList.findIndex(uid => uid === fid)].name
  };
  addChlidDB(database, `friends/${fid}/notifications`, key, notification);

  removeDB(database, `friends/${user.uid}/received/${fid}`);
  removeDB(database, `friends/${fid}/sent/${user.uid}`);
  await updateFriendList();
}

async function removeFriend(e) {
  await updateFriendList();
  let hash = e.target.parentElement.dataset.hash;
  let fid = e.target.parentElement.dataset.id;
  removeDB(database, `friends/${user.uid}/friends/${fid}`);
  removeDB(database, `friends/${fid}/friends/${user.uid}`);
  removeDB(database, `chat/${hash}`);
}

//listener
searchInp.addEventListener("input", (e) => {
  if (e.target.value === "") searchCnt.innerHTML = "";
  let value = e.target.value;
  // searchCnt.innerHTML = "";
  let html = "";
  if (value === "") return;
  let regex = new RegExp(value, "gi");
  namesList.forEach((obj, idx) => {
    if (obj.name.match(regex)) {
      html += updateSearchResult(uidList[idx], idx);
    }
  });
  searchCnt.innerHTML = html;
  addBtnListener();
});

function addBtnListener() {
  addBtn = document.querySelectorAll(".main__add-friend");
  addBtn.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      sendRequest(e.target.parentElement.dataset.id);
      removeSerachFriendResult(e);
    });
  });
}

// ----------------------- update user page -------------------------------------
const cnt = document.querySelectorAll(".main__req-cards");

async function updateFriendList() {
  let friends_data = await readDB(database, `friends/${user.uid}`);
  friendlist = friends_data.val();
}

// Add friends to the friends list
async function addFriendList(data) {
  if (!data.val()) return;
  console.log(data.val());
  let fid = data.key;
  let hash = data.val();
  friendsUID.push(fid);
  let cnt = document.querySelector(".main__friend-cnt");
  let chatUid = namesList[uidList.findIndex((UID) => UID === fid)];
  cnt.innerHTML += `<div class="main__friend-card" data-id=${fid} data-hash=${hash}>
    <img
      src="${chatUid.photo}"
      alt="Friend"
      class="main__img"
    />
    <p class="main__friend-name">${chatUid.name}</p>
    <img class="main__remove-friend-ic" src="./assets/icons/home/reject.svg" alt="remove friend">
  </div>\n`;
  document
    .querySelectorAll(`.main__friend-card>.main__remove-friend-ic`)
    .forEach((reject) => {
      reject.addEventListener("click", removeFriend);
    });
}

// Remove friends from the friends list
async function removeFriendList(data) {
  let cnt = document.querySelector(".main__friend-cnt");
  if(!data.val()){
    cnt.innerHTML = "";
    friendsUID = [];
    return;
  }
  console.log(data.val());
  let remove_friend_elem = document.querySelector(
    `.main__friend-card[data-hash="${data.val()}"]`
  );
  friendsUID.splice(remove_friend_elem.dataset.id, 1);
  console.log(friendsUID);
  cnt.removeChild(remove_friend_elem);
  await updateFriendList();
  // console.log(friendlist);
}

// Update friend request received
async function updateRequestReceived(data) {
  await updateFriendList();
  console.log(friendlist, data.val(), data.key);
  if (!data.val()) {
    cnt[0].innerHTML = "";
    return;
  }
  let receivedKey = data.key;
  let list_user = namesList[uidList.findIndex((UID) => UID === receivedKey)];
  cnt[0].innerHTML += `<div class="main__received-card default" data-id=${receivedKey}>
  <img
    src="${list_user.photo}"
    alt="Friend"
    class="main__img"
  />
  <p class="main__friend-name">${list_user.name}</p>
  <img class="main__add-friend-ic" src="./assets/icons/home/accept.svg" alt="accept">
  <img class="main__remove-friend-ic" src="./assets/icons/home/reject.svg" alt="reject">
</div>`;
  document.querySelectorAll(`.main__add-friend-ic`).forEach((accept) => {
    accept.addEventListener("click", addFriend);
  });
  document.querySelectorAll(`.main__remove-friend-ic`).forEach((reject) => {
    reject.addEventListener("click", rejectFriend);
  });
}

// Remove friend request received
async function removeRequestReceived(data) {
  console.log(data.val(), data.key);
  if (!data.val()) {
    cnt[0].innerHTML = "";
  }
  let sent_frnd_elem = document.querySelector(
    `.main__received-card[data-id="${data.key}"]`
  );
  cnt[0].removeChild(sent_frnd_elem);
}

// Update friend request sent
async function updateRequestSent(data) {
  await updateFriendList();
  let sentData = data.val();
  if (!sentData) {
    cnt[1].innerHTML = "";
    return;
  }
  let sent = data.key;
  console.log(sent);
  let list_user = namesList[uidList.findIndex((UID) => UID === sent)];
  cnt[1].innerHTML += `<div class="main__sent-card default" data-id=${sent}>
    <img
      src="${list_user.photo}"
      alt="Friend"
      class="main__img"
    />
    <p class="main__friend-name">${list_user.name}</p>
    <img class="main__pending-friend-ic default" src="./assets/icons/home/pending.svg" alt="pending">
  </div>`;
}

// Remove friend request sent
async function removeRequestSent(data) {
  if (!data.val()) {
    cnt[1].innerHTML = "";
  }
  let sent_frnd_elem = document.querySelector(
    `.main__sent-card[data-id="${data.key}"]`
  );
  console.log(sent_frnd_elem, data.val(), data.key);
  cnt[1].removeChild(sent_frnd_elem);
}

// ------------------------- db listener --------------------------
function addDbListener() {
  setDBListener(database, `users`, "child_added", appendList); //Listener for updating total users

  // Listener for updating friends list
  setDBListener(database, `friends/${user.uid}/friends`, "child_added", addFriendList);
  setDBListener(database, `friends/${user.uid}/friends`,"child_removed", removeFriendList);

  // Listener for updating friends requests sent
  setDBListener(database, `friends/${user.uid}/sent`, "child_added", updateRequestSent);
  setDBListener(database, `friends/${user.uid}/sent`, "child_removed", removeRequestSent);

  // Listener for updating friends requests received
  setDBListener(database, `friends/${user.uid}/received`, "child_added", updateRequestReceived);
  setDBListener(database, `friends/${user.uid}/received`, "child_removed", removeRequestReceived);
}

// function setDBListener(reference, type, callBack) {
//   database.ref(reference).on(type, callBack);
// }
