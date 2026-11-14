const dateInput = document.querySelector("#booking-date");
const slotsContainer = document.querySelector("#slots");
const selectedSlotInput = document.querySelector("#selected-slot");
const bookingForm = document.querySelector("#booking-form");
const message = document.querySelector("#message");
// 預約成功介面
const loginSection = document.querySelector("#login-section");
const bookingSection = document.querySelector("#booking-section");
const formSection = document.querySelector("#form-section");
const successSection = document.querySelector("#success-section");

const continueBookingButton = document.querySelector(
  "#continue-booking-button"
);

// 我的預約介面
const myBookingsButton = document.querySelector("#my-bookings-button");
const successMyBookingsButton = document.querySelector("#success-my-bookings-button");
const myBookingsSection = document.querySelector("#my-bookings-section");
const myBookingsList = document.querySelector("#my-bookings-list");
const myBookingsStatus = document.querySelector("#my-bookings-status");

const refreshBookingsButton = document.querySelector("#refresh-bookings-button");
const backToBookingButton = document.querySelector("#back-to-booking-button");

const introSection = document.querySelector(".intro");

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
  // 驗證完成前，不開放查詢
  myBookingsButton.hidden = true;
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

    // 後端驗證成功後，開放我的預約入口
myBookingsButton.hidden = false;

// 自動填入 Email，並禁止學生修改
const emailInput = document.querySelector("#student-email");

emailInput.value = verifiedGoogleEmail;
emailInput.readOnly = true;

loginStatus.textContent =
  `登入成功：${verifiedGoogleEmail}`;
    console.log("Google 後端驗證成功");

  } catch (error) {

    googleCredential = null;
    verifiedGoogleEmail = null;
    const emailInput = document.querySelector("#student-email");

emailInput.value = "";
emailInput.readOnly = false;

    loginStatus.textContent =
      "登入驗證失敗：" + error.message;

      console.error("Google 後端驗證失敗：", error);
    }
    }
  });
  google.accounts.id.renderButton(
    document.querySelector("#google-login-button"),
    {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      width: 280
    }
  );

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



bookingForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  // 1. 確認 Google 登入
  if (!googleCredential || !verifiedGoogleEmail) {
    message.textContent = "請先完成 Google 身分驗證。";
    return;
  }

  // 2. 確認時段載入完成
  if (isLoading) {
    message.textContent = "時段仍在載入，請稍候。";
    return;
  }

  // 3. 確認已選擇時段
  if (!selectedSlot) {
    message.textContent = "請先選擇預約時段。";
    return;
  }

  // 4. 驗證表單
  if (!bookingForm.reportValidity()) {
    return;
  }

  const submitButton = document.querySelector("#submit-button");

  // 暫存本次預約資料，避免等待後端時資料改變
  const bookingSlot = { ...selectedSlot };

  const bookingInfo = {
    className: document.querySelector("#class-name").value.trim(),
    studentName: document.querySelector("#student-name").value.trim(),
    seatNumber: document.querySelector("#seat-number").value
  };

  // 防止重複點擊
  submitButton.disabled = true;
  message.textContent = "正在建立預約，請稍候……";

  try {

    // 5. 傳送資料至 Apps Script
    const response = await fetch(API_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({

        action: "createBooking",

        credential: googleCredential,

        slotId: bookingSlot.id,

        className: bookingInfo.className,

        studentName: bookingInfo.studentName,

        seatNumber: bookingInfo.seatNumber

      })
    });

    const result = await response.json();

    // 6. 判斷後端是否成功
    if (!response.ok || !result.ok) {
      throw new Error(result.message || "預約失敗");
    }

    // 7. 移除已預約時段
    allSlots = allSlots.filter(
      slot => slot.id !== bookingSlot.id
    );

    selectedSlot = null;
    selectedSlotInput.value = "";

    // 8. 填入成功畫面的資料
    document.querySelector("#success-name").textContent =
      bookingInfo.studentName;

    document.querySelector("#success-class").textContent =
      bookingInfo.className;

    document.querySelector("#success-seat").textContent =
      bookingInfo.seatNumber;

    document.querySelector("#success-date").textContent =
      result.date || bookingSlot.date;

    document.querySelector("#success-time").textContent =
      result.time || bookingSlot.time;

    // 9. 隱藏原本的預約介面
    loginSection.hidden = true;
    bookingSection.hidden = true;
    formSection.hidden = true;

    // 10. 顯示預約成功介面
    successSection.hidden = false;

    console.log("預約成功：", result);

  } catch (error) {

    message.textContent =
      "預約失敗：" + error.message;

    console.error("建立預約失敗：", error);

  } finally {

    submitButton.disabled = false;

  }

});

// 繼續預約其他時段
continueBookingButton.addEventListener("click", () => {

  // 隱藏成功畫面
  successSection.hidden = true;

  // 恢復預約介面
  loginSection.hidden = false;
  bookingSection.hidden = false;
  formSection.hidden = false;

  // 清空表單
  bookingForm.reset();

  // 保留已驗證的 Google 帳號
  const emailInput = document.querySelector("#student-email");

  emailInput.value = verifiedGoogleEmail || "";
  emailInput.readOnly = Boolean(verifiedGoogleEmail);

  selectedSlot = null;
  selectedSlotInput.value = "";

  message.textContent = "";

  // 重新從後端讀取可預約時段
  loadSlots();

});


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


// ==============================
// 階段 2-2：我的預約
// ==============================

// 建立預約資料列
function createBookingDetail(label, value) {

  const row = document.createElement("div");
  row.className = "my-booking-detail";

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  const valueElement = document.createElement("strong");
  valueElement.textContent = String(value ?? "—");

  row.append(labelElement, valueElement);

  return row;
}


// 顯示單筆預約卡片
function createBookingCard(booking) {

  const card = document.createElement("article");
  card.className = "my-booking-card";

  const header = document.createElement("div");
  header.className = "my-booking-header";

  const dateTitle = document.createElement("h3");
  dateTitle.textContent = booking.date || "日期未提供";

  const status = document.createElement("span");
  status.className = "my-booking-status";
  status.textContent = booking.status || "未註明";

  if (booking.status === "已預約") {
    status.classList.add("is-active");
  }

  header.append(dateTitle, status);

  card.append(
    header,
    createBookingDetail("預約時間", booking.time),
    createBookingDetail("學生姓名", booking.studentName),
    createBookingDetail("班級", booking.className),
    createBookingDetail("座號", booking.seatNumber)
  );

  return card;
}


// 向後端查詢目前登入者的所有預約
async function showMyBookings() {

  if (!googleCredential || !verifiedGoogleEmail) {
    document.querySelector("#login-status").textContent =
      "請先完成 Google 身分驗證。";
    return;
  }

  // 暫存此次查詢的登入身分
  const requestedCredential = googleCredential;
  const requestedEmail = verifiedGoogleEmail;

  // 隱藏其他頁面
  introSection.hidden = true;
  loginSection.hidden = true;
  bookingSection.hidden = true;
  formSection.hidden = true;
  successSection.hidden = true;

  // 顯示我的預約頁面
  myBookingsSection.hidden = false;

  myBookingsList.replaceChildren();
  myBookingsStatus.textContent = "正在載入預約紀錄……";

  refreshBookingsButton.disabled = true;

  try {

    const response = await fetch(API_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "getMyBookings",
        credential: requestedCredential
      })
    });

    const result = await response.json();

    // 如果登入身分已經改變，不顯示舊帳號的資料
    if (
      requestedCredential !== googleCredential ||
      requestedEmail !== verifiedGoogleEmail
    ) {
      return;
    }

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "查詢失敗");
    }

    if (!Array.isArray(result.bookings)) {
      throw new Error("後端回傳的預約資料格式不正確");
    }

    const bookings = result.bookings;

    // 沒有任何預約
    if (bookings.length === 0) {
      myBookingsStatus.textContent = "目前沒有預約紀錄。";
      return;
    }

    myBookingsStatus.textContent =
      `共 ${bookings.length} 筆預約紀錄`;

    // 產生每筆預約卡片
    bookings.forEach((booking) => {
      const card = createBookingCard(booking);
      myBookingsList.appendChild(card);
    });

    console.log("我的預約載入成功，共", bookings.length, "筆");

  } catch (error) {

    if (
      requestedCredential !== googleCredential ||
      requestedEmail !== verifiedGoogleEmail
    ) {
      return;
    }

    myBookingsStatus.textContent =
      "讀取失敗：" + error.message +
      "。如果登入憑證已過期，請返回預約頁面重新登入。";

    console.error("查詢我的預約失敗：", error);

  } finally {

    refreshBookingsButton.disabled = false;

  }

}


// 登入後的「查看我的預約」
myBookingsButton.addEventListener("click", showMyBookings);


// 成功頁面的「查看我的預約」
successMyBookingsButton.addEventListener("click", showMyBookings);


// 重新整理預約紀錄
refreshBookingsButton.addEventListener("click", showMyBookings);


// 返回預約頁面
backToBookingButton.addEventListener("click", () => {

  myBookingsSection.hidden = true;

  introSection.hidden = false;
  loginSection.hidden = false;
  bookingSection.hidden = false;
  formSection.hidden = false;
  successSection.hidden = true;

  // 清空舊的查詢畫面
  myBookingsList.replaceChildren();
  myBookingsStatus.textContent = "";

  // 重新取得最新時段
  loadSlots();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

});
