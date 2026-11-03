const dateInput = document.querySelector("#booking-date");
const slotsContainer = document.querySelector("#slots");
const selectedSlotInput = document.querySelector("#selected-slot");
const bookingForm = document.querySelector("#booking-form");
const message = document.querySelector("#message");

const API_URL =
  "https://script.google.com/macros/s/AKfycbz7jicWXtx9kIAHqsV0neM0b_2lvqKPhF6ApNv9gDUUvKohN1aBqoEd3iS-7AYWso5J/exec";
  // ==============================
// Google 登入設定
// ==============================

const GOOGLE_CLIENT_ID =
  "585973761770-cgaijj4lsu268rrgo170eo9vb93hotc6.apps.googleusercontent.com";

// 暫存 Google 登入憑證
let googleCredential = null;
let verifiedGoogleEmail = null;
// 初始化 Google 登入
function initializeGoogleLogin() {

  if (!window.google?.accounts?.id) {
    return false;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,

   callback: async function (response) {

  googleCredential = response.credential;
  verifiedGoogleEmail = null;

  const loginStatus = document.querySelector("#login-status");

  loginStatus.textContent = "正在向 Google 驗證登入身分……";

  try {

    const result = await fetch(API_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "verifyGoogleToken",
        credential: googleCredential
      })
    });

    const data = await result.json();

    if (!result.ok || !data.ok) {
      throw new Error(data.message || "身分驗證失敗");
    }

    // 只有後端驗證成功，才記錄可信任的 Email
    verifiedGoogleEmail = data.email;

    loginStatus.textContent =
      `登入成功：${verifiedGoogleEmail}`;

    console.log("Google 後端驗證成功");

  } catch (error) {

    googleCredential = null;
    verifiedGoogleEmail = null;

    loginStatus.textContent =
      "登入驗證失敗：" + error.message;

    console.error("Google 後端驗證失敗：", error);

  }
};

  return true;
}

// 等待 Google 登入程式庫載入
function waitForGoogleLogin() {

  const initialized = initializeGoogleLogin();

  if (!initialized) {
    setTimeout(waitForGoogleLogin, 300);
  }

}

// 啟動 Google 登入
waitForGoogleLogin();

let allSlots = [];
let selectedSlot = null;
let isLoading = true;

// 取得今天的日期，格式為 YYYY-MM-DD
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// 將試算表日期轉成日期選擇器使用的格式
function normalizeDate(dateString) {
  const parts = dateString.split(/[/-]/);

  if (parts.length !== 3) {
    return "";
  }

  const [year, month, day] = parts;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// 載入可預約時段
function loadSlots() {
  isLoading = true;
  renderSlots();

  const callbackName =
    "onBookingSlotsLoaded_" + Date.now();

  const apiScript = document.createElement("script");
  let finished = false;

  function cleanup() {
    finished = true;
    apiScript.remove();
    delete window[callbackName];
  }

  window[callbackName] = function (result) {
    if (finished) return;

    cleanup();
    isLoading = false;

    if (!result || !result.ok || !Array.isArray(result.slots)) {
      message.textContent =
        "無法讀取預約時段，請稍後再試。";
      renderSlots();
      return;
    }

    allSlots = result.slots
      .map((slot) => ({
        id: slot.id,
        date: normalizeDate(slot.date),
        time: slot.time
      }))
      .filter((slot) => slot.id && slot.date && slot.time);

    // 若今天沒有時段，預設選擇最近一個可預約日期
    const today = getLocalDateString();
    dateInput.min = today;

    const futureSlots = allSlots
      .filter((slot) => slot.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (
      !dateInput.value ||
      !allSlots.some((slot) => slot.date === dateInput.value)
    ) {
      dateInput.value = futureSlots.length
        ? futureSlots[0].date
        : today;
    }

    renderSlots();
  };

  apiScript.onerror = function () {
    if (finished) return;

    cleanup();
    isLoading = false;
    message.textContent =
      "連線失敗，請重新整理頁面後再試。";
    renderSlots();
  };

  apiScript.src =
    API_URL +
    "?callback=" +
    encodeURIComponent(callbackName);

  document.head.appendChild(apiScript);
}

// 顯示所選日期的時段
function renderSlots() {
  slotsContainer.replaceChildren();

  selectedSlot = null;
  selectedSlotInput.value = "";

  if (isLoading) {
    message.textContent = "正在載入可預約時段……";
    return;
  }

  const selectedDate = dateInput.value;

  const availableSlots = allSlots
    .filter((slot) => slot.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  if (availableSlots.length === 0) {
    message.textContent = "這個日期目前沒有開放的預約時段。";
    return;
  }

  message.textContent = "";

  availableSlots.forEach((slot) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "slot-button";
    button.textContent = slot.time;
    button.setAttribute("aria-pressed", "false");

    button.addEventListener("click", () => {
      document.querySelectorAll(".slot-button").forEach((item) => {
        item.classList.remove("selected");
        item.setAttribute("aria-pressed", "false");
      });

      button.classList.add("selected");
      button.setAttribute("aria-pressed", "true");

      selectedSlot = slot;

      // 暫存時段編號，後續真實預約功能會用到
      selectedSlotInput.value = slot.id;

      message.textContent = "";
    });

    slotsContainer.appendChild(button);
  });
}

dateInput.addEventListener("change", renderSlots);

// 目前只測試登入與表單，不會建立真實預約
bookingForm.addEventListener("submit", (event) => {

  event.preventDefault();

  if (!verifiedGoogleEmail) {
  message.textContent = "請先完成 Google 身分驗證。";
  return;
}

  if (isLoading) {
    message.textContent = "時段仍在載入，請稍候。";
    return;
  }

  if (!selectedSlot) {
    message.textContent = "請先選擇預約時段。";
    return;
  }

  if (!bookingForm.reportValidity()) {
    return;
  }

  message.textContent =
    "前端測試成功！Google 登入憑證尚未經後端驗證，目前不會建立真實預約。";

});
  message.textContent =


// 網頁載入後讀取試算表
loadSlots();

async function testPostConnection() {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "ping"
      })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "後端回應失敗");
    }

    console.log("POST 測試成功：", result);

  } catch (error) {
    console.error("POST 測試失敗：", error);
  }
}

// 暫時測試一次
testPostConnection();
