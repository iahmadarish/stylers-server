import axios from 'axios';

// Pathao real API credentials 
// const PATHAO_CLIENT_ID = 'openR4Ee7A';
// const PATHAO_CLIENT_SECRET = 'Czf5H6wQ0qdyD5gEN2hjQFVF1sS6KZRMtMfTR2L5';
// const PATHAO_USERNAME = 'nayem.cdab@gmail.com';
// const PATHAO_PASSWORD = 'Life0304@';
// const PATHAO_BASE_URL = 'https://api-hermes.pathao.com';
// const PATHAO_STORE_ID = 165272;

// fake api credendital
const PATHAO_CLIENT_ID = 'sdfadf';
const PATHAO_CLIENT_SECRET = 'jklfjsdf';
const PATHAO_USERNAME = 'idemo.cdab@gmail.com';
const PATHAO_PASSWORD = 'Life0304@';
const PATHAO_BASE_URL = 'https://api-hermes.pathao.comss';
const PATHAO_STORE_ID = 345789345;



export { PATHAO_BASE_URL };

let accessToken = null;
let tokenExpiry = null;

const getPathaoToken = async () => {
  try {
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
      return accessToken;
    }

    console.log('Getting Pathao token from:', PATHAO_BASE_URL);
    
    const response = await axios.post(`${PATHAO_BASE_URL}/aladdin/api/v1/issue-token`, {
      client_id: PATHAO_CLIENT_ID,
      client_secret: PATHAO_CLIENT_SECRET,
      username: PATHAO_USERNAME,
      password: PATHAO_PASSWORD,
      grant_type: 'password'
    });

    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;

    console.log('Pathao token obtained successfully');
    return accessToken;
  } catch (error) {
    console.error('Pathao token error:', error.response?.data || error.message);
    throw new Error('Failed to get Pathao token');
  }
};

export const createPathaoOrder = async (order) => {
  try {
    console.log('Creating Pathao order for:', order.orderNumber);
    
    const token = await getPathaoToken();

    const pathaoOrderData = {
      store_id: PATHAO_STORE_ID,
      merchant_order_id: order.orderNumber,
      
      // Recipient Data
      recipient_name: order.shippingAddress.fullName,
      recipient_phone: order.shippingAddress.phone,
      recipient_address: order.shippingAddress.address.length >= 10 
        ? order.shippingAddress.address 
        : `${order.shippingAddress.address} - Full Address`, 
      recipient_city: 1, // Dhaka
      recipient_zone: 1, // Gulshan
      recipient_area: 1, // Gulshan 1
      
      // Shipment Details
      delivery_type: 48,
      item_type: 2,
      item_quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      item_weight: 1,
      amount_to_collect: order.paymentMethod === 'cash_on_delivery' ? order.totalAmount : 0,
      
      // Other Details
      item_description: order.items.map(item => 
        `${item.productTitle} x ${item.quantity}`
      ).join(', '),
      special_instruction: order.specialInstructions || '',
      
      sender_name: 'PAAREL',
      sender_phone: '01700000000',
      sender_address: 'Your Store Full Address, City, Bangladesh',
    };

    console.log('Pathao order data:', JSON.stringify(pathaoOrderData, null, 2));

    const response = await axios.post(
      `${PATHAO_BASE_URL}/aladdin/api/v1/orders`,
      pathaoOrderData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('Pathao order created successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Pathao order creation error:', error.response?.data || error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
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

// Debugging function for sandbox
export const testPathaoConnection = async () => {
  try {
    console.log('Testing Pathao Sandbox Connection...');
    console.log('Base URL:', PATHAO_BASE_URL);
    console.log('Store ID:', PATHAO_STORE_ID);
    
    const token = await getPathaoToken();
    console.log('Token obtained successfully');
    
    // Try to get store list to verify store_id
    try {
      const response = await axios.get(
        `${PATHAO_BASE_URL}/aladdin/api/v1/stores`,
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
    
    return { success: true, message: 'Connection test successful' };
  } catch (error) {
    console.error('Connection test failed:', error.message);
    return { success: false, error: error.message };
  }
};