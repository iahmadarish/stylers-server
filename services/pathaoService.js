// import axios from 'axios';

// // Pathao API credentials
// const PATHAO_CLIENT_ID = process.env.PATHAO_CLIENT_ID;
// const PATHAO_CLIENT_SECRET = process.env.PATHAO_CLIENT_SECRET;
// const PATHAO_USERNAME = process.env.PATHAO_USERNAME;
// const PATHAO_PASSWORD = process.env.PATHAO_PASSWORD;
// const PATHAO_BASE_URL = "https://api-hermes.pathao.com";
// const PATHAO_STORE_ID = parseInt(process.env.PATHAO_STORE_ID);


// let accessToken = null;
// let tokenExpiry = null;


// const getPathaoToken = async () => {
//   try {
    
//     if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
//       return accessToken;
//     }

//     console.log('Getting Pathao token from:', PATHAO_BASE_URL);
    
//     const response = await axios.post(`${PATHAO_BASE_URL}/aladdin/api/v1/issue-token`, {
//       client_id: PATHAO_CLIENT_ID,
//       client_secret: PATHAO_CLIENT_SECRET,
//       username: PATHAO_USERNAME,
//       password: PATHAO_PASSWORD,
//       grant_type: 'password'
//     });

//     accessToken = response.data.access_token;
    
//     tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;

//     console.log('Pathao token obtained successfully');
//     return accessToken;
//   } catch (error) {
//     console.error('Pathao token error:', error.response?.data || error.message);
//     throw new Error('Failed to get Pathao token');
//   }
// };


// export const createPathaoOrder = async (order) => {
//   try {
//     console.log('Creating Pathao order for:', order.orderNumber);
    
//     const token = await getPathaoToken();

//     // Sandbox environment simplified location data
//     const pathaoOrderData = {
//       store_id: PATHAO_STORE_ID,
//       merchant_order_id: order.orderNumber,
//       recipient_name: order.shippingAddress.fullName,
//       recipient_phone: order.shippingAddress.phone,
//       recipient_address: order.shippingAddress.address,
//       recipient_city: 1, // Dhaka for sandbox
//       recipient_zone: 1, // Gulshan for sandbox
//       recipient_area: 1, // Gulshan 1 for sandbox
//       item_type: 2, // Parcel
//       item_quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
//       item_weight: 1, // kg
//       amount_to_collect: order.paymentMethod === 'cash_on_delivery' ? order.totalAmount : 0,
//       item_description: order.items.map(item => 
//         `${item.productTitle} x ${item.quantity}`
//       ).join(', '),
//       delivery_type: 48, // 48 hours delivery
//       special_instruction: order.specialInstructions || '',
//     };

//     console.log('Pathao order data:', JSON.stringify(pathaoOrderData, null, 2));

//     const response = await axios.post(
//       `${PATHAO_BASE_URL}/aladdin/api/v1/orders`,
//       pathaoOrderData,
//       {
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//           'Accept': 'application/json'
//         },
//         timeout: 10000 // 10 second timeout
//       }
//     );

//     console.log('Pathao order created successfully:', response.data);
//     return response.data;
//   } catch (error) {
//     console.error('Pathao order creation error:', error.response?.data || error.message);
    
//     // More detailed error logging
//     if (error.response) {
//       console.error('Status:', error.response.status);
//       console.error('Headers:', error.response.headers);
//       console.error('Data:', error.response.data);
//     } else if (error.request) {
//       console.error('No response received:', error.request);
//     } else {
//       console.error('Error message:', error.message);
//     }
    
//     throw new Error('Failed to create Pathao order');
//   }
// };

// // Debugging function for sandbox
// export const testPathaoConnection = async () => {
//   try {
//     console.log('Testing Pathao Sandbox Connection...');
//     console.log('Base URL:', PATHAO_BASE_URL);
//     console.log('Store ID:', PATHAO_STORE_ID);
    
//     const token = await getPathaoToken();
//     console.log('Token obtained successfully');
    
//     // Try to get store list to verify store_id
//     try {
//       const response = await axios.get(
//         `${PATHAO_BASE_URL}/aladdin/api/v1/stores`,
//         {
//           headers: {
//             'Authorization': `Bearer ${token}`,
//             'Accept': 'application/json'
//           }
//         }
//       );
//       console.log('Available stores:', response.data);
//     } catch (storeError) {
//       console.log('Store list not available in sandbox, continuing...');
//     }
    
//     return { success: true, message: 'Connection test successful' };
//   } catch (error) {
//     console.error('Connection test failed:', error.message);
//     return { success: false, error: error.message };
//   }
// };


import axios from 'axios';

// ❌ OLD: এই ফাইল-লেভেলের ভ্যারিয়েবল ডিক্লারেশনগুলো সমস্যার সৃষ্টি করছিল। 
// const PATHAO_CLIENT_ID = process.env.PATHAO_CLIENT_ID;
// const PATHAO_CLIENT_SECRET = process.env.PATHAO_CLIENT_SECRET;
// const PATHAO_USERNAME = process.env.PATHAO_USERNAME;
// const PATHAO_PASSWORD = process.env.PATHAO_PASSWORD;
// const PATHAO_BASE_URL = process.env.PATHAO_BASE_URL;
// const PATHAO_STORE_ID = parseInt(process.env.PATHAO_STORE_ID);


let accessToken = null;
let tokenExpiry = null;


// ✅ নতুন Helper Function: রানটাইমে Config লোড করবে।
const getConfig = () => {
    // যেকোনো একটি গুরুত্বপূর্ণ ভ্যারিয়েবল না পেলে error দেবে
    if (!process.env.PATHAO_BASE_URL) {
        throw new Error("Pathao environment variable (PATHAO_BASE_URL, etc.) is not defined. Check your .env file and server startup process.");
    }
    
    return {
        PATHAO_CLIENT_ID: process.env.PATHAO_CLIENT_ID,
        PATHAO_CLIENT_SECRET: process.env.PATHAO_CLIENT_SECRET,
        PATHAO_USERNAME: process.env.PATHAO_USERNAME,
        PATHAO_PASSWORD: process.env.PATHAO_PASSWORD,
        PATHAO_BASE_URL: process.env.PATHAO_BASE_URL,
        // parseInt ব্যবহার করার আগে নিশ্চিত করুন যে ভ্যারিয়েবলটি আছে
        PATHAO_STORE_ID: process.env.PATHAO_STORE_ID ? parseInt(process.env.PATHAO_STORE_ID) : null, 
    };
};


// ✅ ফাংশন ১: getPathaoToken (getConfig ব্যবহার করে)
const getPathaoToken = async () => {
    const config = getConfig(); // ফাংশনের ভিতরে config লোড হচ্ছে
    
    try {
        if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
            return accessToken;
        }

        console.log('Getting Pathao token from:', config.PATHAO_BASE_URL);
        
        const response = await axios.post(`${config.PATHAO_BASE_URL}/aladdin/api/v1/issue-token`, {
            client_id: config.PATHAO_CLIENT_ID,
            client_secret: config.PATHAO_CLIENT_SECRET,
            username: config.PATHAO_USERNAME,
            password: config.PATHAO_PASSWORD,
            grant_type: 'password'
        });

        accessToken = response.data.access_token;
        
        tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;

        return accessToken;

    } catch (error) {
        console.error("Error getting Pathao token:", error.message);
        if (error.response) {
            console.error('Pathao Auth Error Data:', error.response.data);
        }
        throw new Error('Failed to get Pathao authentication token');
    }
};

// ✅ ফাংশন ২: createPathaoOrder (getConfig ব্যবহার করে)
export const createPathaoOrder = async (orderData) => {
    const config = getConfig(); // ফাংশনের ভিতরে config লোড হচ্ছে
    
    try {
        const token = await getPathaoToken();
        
        const response = await axios.post(
            `${config.PATHAO_BASE_URL}/aladdin/api/v1/orders`,
            { ...orderData, store_id: config.PATHAO_STORE_ID }, // store_id config থেকে নিশ্চিত করা হচ্ছে
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            }
        );

        return response.data;

    } catch (error) {
        console.error('Pathao order creation error:', error.response ? error.response.data : error.message);
        console.error('Status:', error.response ? error.response.status : 'N/A');
        
        // Detailed error logging
        if (error.response) {
            console.error('Headers:', error.response.headers);
            console.error('Data:', error.response.data);
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Error message:', error.message);
        }
        
        throw new Error('Failed to create Pathao order');
    }
};

// ✅ ফাংশন ৩: testPathaoConnection (getConfig ব্যবহার করে)
// Debugging function for sandbox
export const testPathaoConnection = async () => {
    const config = getConfig(); // ফাংশনের ভিতরে config লোড হচ্ছে
    
    try {
        console.log('Testing Pathao Sandbox Connection...');
        console.log('Base URL:', config.PATHAO_BASE_URL);
        console.log('Store ID:', config.PATHAO_STORE_ID);
        
        const token = await getPathaoToken();
        console.log('Token obtained successfully');
        
        // Try to get store list to verify store_id
        try {
            const response = await axios.get(
                `${config.PATHAO_BASE_URL}/aladdin/api/v1/stores`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                }
            );
            console.log('Available stores:', response.data);
        } catch (storeError) {
            console.log('Store list not available in sandbox, continuing...');
        }
        
        return { success: true, message: 'Pathao connection test successful.' };

    } catch (error) {
        console.error('Pathao connection test failed:', error.message);
        return { success: false, message: error.message };
    }
};