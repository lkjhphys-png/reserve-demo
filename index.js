
const dateInput = document.querySelector("#booking-date");
const slotsContainer = document.querySelector("#slots");
const selectedSlotInput = document.querySelector("#selected-slot");
const bookingForm = document.querySelector("#booking-form");
const message = document.querySelector("#message");

const timeSlots = [
  "12:30–13:00",
  "16:10–17:00",
];

let selectedSlot = "";

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const today = getLocalDateString();
dateInput.min = today;
dateInput.value = today;

function renderSlots() {
  slotsContainer.replaceChildren();
  selectedSlot = "";
  selectedSlotInput.value = "";

  message.textContent = "";

  const selectedDate = new Date(dateInput.value + "T00:00:00");
  const isTuesday = selectedDate.getDay() === 2;

  const availableSlots = timeSlots.filter(
   (time) => !(isTuesday && time === "16:10–17:00")
);

availableSlots.forEach((time) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "slot-button";
    button.textContent = time;

    button.addEventListener("click", () => {
      document.querySelectorAll(".slot-button").forEach((slotButton) => {
        slotButton.classList.remove("selected");
        slotButton.setAttribute("aria-pressed", "false");
      });

      button.classList.add("selected");
      button.setAttribute("aria-pressed", "true");

      selectedSlot = time;
      selectedSlotInput.value = time;
      message.textContent = "";
    });

    button.setAttribute("aria-pressed", "false");
    slotsContainer.appendChild(button);
  });
}

dateInput.addEventListener("change", renderSlots);

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!selectedSlot) {
    message.textContent = "請先選擇預約時段。";
    return;
  }

  if (!bookingForm.reportValidity()) {
    return;
  }

  message.textContent =
    "表單測試成功！目前尚未建立真實預約，資料也沒有送到老師的信箱。";
});

renderSlots();
