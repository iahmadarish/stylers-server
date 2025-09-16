import sendMimSMS from "./mimSmsService.js"

const sendSMS = async ({ phone, message }) => {
  try {
    // Mims sms
    return await sendMimSMS({ phone, message })
  } catch (error) {
    console.error("SMS sending failed:", error)
    throw error
  }
}

export default sendSMS