import axios from "axios"

// সরাসরি values ব্যবহার করছি
const MIMSMS_CONFIG = {
  API_KEY: "6US1ZZDG1CY9A3L",
  SENDER_ID: "8809617623024", 
  USER_NAME: "paarel.media@gmail.com",
  API_URL: "https://api.mimsms.com/api/SmsSending/SMS"
}

// Debug logging
console.log("MIMSMS Config loaded:", {
  API_KEY: MIMSMS_CONFIG.API_KEY,
  SENDER_ID: MIMSMS_CONFIG.SENDER_ID,
  USER_NAME: MIMSMS_CONFIG.USER_NAME,
  API_URL: MIMSMS_CONFIG.API_URL
})

export const sendMimSMS = async ({ phone, message }) => {
  try {
    console.log("📱 Attempting to send SMS to:", phone)

    // Phone format 
    let formattedPhone = phone
    if (phone.startsWith("+")) {
      formattedPhone = phone.substring(1) // Remove + sign
    }
    if (!formattedPhone.startsWith("88")) {
      formattedPhone = `88${formattedPhone}`
    }

    console.log("📞 Formatted phone:", formattedPhone)

    // MIMSMS API request body 
    const requestBody = {
      ApiKey: MIMSMS_CONFIG.API_KEY,
      MobileNumber: formattedPhone,
      SenderName: MIMSMS_CONFIG.SENDER_ID,
      UserName: MIMSMS_CONFIG.USER_NAME,
      TransactionType: "T", // T = Transactional
      Message: message
    }

    console.log("🌐 Calling API URL:", MIMSMS_CONFIG.API_URL)
    console.log("📦 Request Body:", JSON.stringify(requestBody, null, 2))

    const response = await axios.post(MIMSMS_CONFIG.API_URL, requestBody, {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      timeout: 10000 // 10 second timeout
    })

    console.log("📡 SMS API Response:", response.data)

    // Check response
   if (response.data && Number(response.data.statusCode) === 200) {
  console.log(" MIMSMS sent successfully")
  return true
} else {
  console.error("MIMSMS error response:", response.data)
  throw new Error(`SMS sending failed: ${JSON.stringify(response.data)}`)
}
  } catch (error) {
    console.error(" Error sending MIMSMS:", error.message)
    if (error.response) {
      console.error(" Response data:", error.response.data)
      console.error("Response status:", error.response.status)
      console.error("Response headers:", error.response.headers)
    }
    throw new Error("Failed to send SMS via MIMSMS: " + error.message)
  }
}

export default sendMimSMS