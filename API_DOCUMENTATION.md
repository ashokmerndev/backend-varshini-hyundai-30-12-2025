# 📚 API Documentation

Complete API reference for Hyundai Spares E-Commerce Platform

## Base URL
```
http://localhost:5000/api
```

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## 🔐 User Authentication

### Register User
**POST** `/auth/register`

**Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "9876543210"
    },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

### User Login
**POST** `/auth/login`

**Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

### Get User Profile
**GET** `/auth/profile`

**Headers:** `Authorization: Bearer <token>`

### Add Address
**POST** `/auth/address`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "addressType": "Home",
  "street": "123 Main Street",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "isDefault": true
}
```

---

## 👔 Admin Authentication

### Admin Login
**POST** `/admin/auth/login`

**Body:**
```json
{
  "email": "admin@hyundaispares.com",
  "password": "Admin@12345"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "admin": {
      "id": "...",
      "name": "Admin",
      "email": "admin@hyundaispares.com",
      "role": "admin"
    },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

---

## 📦 Products

### Get All Products
**GET** `/products`

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 12)
- `category` (string): Filter by category
- `model` (string): Filter by compatible model
- `search` (string): Search in name, description, part number
- `minPrice` (number): Minimum price
- `maxPrice` (number): Maximum price
- `inStock` (boolean): Show only in-stock items
- `sortBy` (string): Sort field (default: createdAt)
- `sortOrder` (string): asc or desc (default: desc)

**Example:**
```
GET /products?category=Engine&model=Creta&page=1&limit=12
```

**Response:**
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": [...],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 12,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Get Product by ID
**GET** `/products/:id`

### Create Product (Admin)
**POST** `/products`

**Headers:** 
- `Authorization: Bearer <admin-token>`
- `Content-Type: multipart/form-data`

**Form Data:**
```
name: "Engine Oil Filter"
partNumber: "EOL123"
description: "High-quality engine oil filter for Hyundai vehicles"
category: "Engine"
compatibleModels: ["Creta", "Verna", "i20"]
price: 450
discountPrice: 400
stock: 100
lowStockThreshold: 10
images: [file1.jpg, file2.jpg]
specifications: {"Size": "Standard", "Material": "Metal"}
warrantyPeriod: "6 months"
tags: ["filter", "engine", "oil"]
```

### Update Product (Admin)
**PUT** `/products/:id`

**Headers:** 
- `Authorization: Bearer <admin-token>`
- `Content-Type: multipart/form-data`

### Update Stock (Admin)
**PATCH** `/products/:id/stock`

**Headers:** `Authorization: Bearer <admin-token>`

**Body:**
```json
{
  "stock": 50
}
```

### Delete Product (Admin)
**DELETE** `/products/:id`

**Headers:** `Authorization: Bearer <admin-token>`

### Get Featured Products
**GET** `/products/featured`

### Get Products by Category
**GET** `/products/category/:category`

**Example:**
```
GET /products/category/Engine
```

### Get Low Stock Products (Admin)
**GET** `/products/low-stock`

**Headers:** `Authorization: Bearer <admin-token>`

---

## 🛒 Cart

### Get Cart
**GET** `/cart`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "Cart retrieved successfully",
  "data": {
    "cart": {
      "_id": "...",
      "user": "...",
      "items": [
        {
          "product": {
            "name": "Engine Oil Filter",
            "partNumber": "EOL123",
            "images": [...]
          },
          "quantity": 2,
          "price": 400,
          "subtotal": 800
        }
      ],
      "totalItems": 2,
      "subtotal": 800,
      "tax": 144,
      "shippingCharges": 100,
      "totalAmount": 1044
    }
  }
}
```

### Add to Cart
**POST** `/cart/add`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "productId": "product_id_here",
  "quantity": 2
}
```

### Update Cart Item
**PUT** `/cart/update/:itemId`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "quantity": 3
}
```

### Remove from Cart
**DELETE** `/cart/remove/:itemId`

**Headers:** `Authorization: Bearer <token>`

### Clear Cart
**DELETE** `/cart/clear`

**Headers:** `Authorization: Bearer <token>`

### Sync Cart
**POST** `/cart/sync`

**Headers:** `Authorization: Bearer <token>`

---

## 📋 Orders

### Create Order
**POST** `/orders`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "shippingAddressId": "address_id_here",
  "paymentMethod": "Razorpay",
  "notes": "Please deliver between 10 AM - 2 PM"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "order": {
      "_id": "...",
      "orderNumber": "ORD20241219001",
      "user": {...},
      "items": [...],
      "totalAmount": 1044,
      "paymentMethod": "Razorpay",
      "paymentStatus": "Pending",
      "orderStatus": "Placed"
    }
  }
}
```

### Get User Orders
**GET** `/orders`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (number)
- `limit` (number)
- `status` (string): Filter by order status

### Get Order by ID
**GET** `/orders/:id`

**Headers:** `Authorization: Bearer <token>`

### Cancel Order
**PUT** `/orders/:id/cancel`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "cancellationReason": "Changed my mind"
}
```

### Get All Orders (Admin)
**GET** `/orders/admin/all`

**Headers:** `Authorization: Bearer <admin-token>`

**Query Parameters:**
- `page` (number)
- `limit` (number)
- `status` (string)
- `paymentStatus` (string)
- `search` (string)
- `startDate` (date)
- `endDate` (date)

### Update Order Status (Admin)
**PUT** `/orders/:id/status`

**Headers:** `Authorization: Bearer <admin-token>`

**Body:**
```json
{
  "orderStatus": "Shipped",
  "trackingNumber": "TRK123456789",
  "courierPartner": "BlueDart",
  "estimatedDelivery": "2024-12-25",
  "note": "Package shipped via BlueDart"
}
```

### Download Invoice
**GET** `/orders/:id/invoice`

**Headers:** `Authorization: Bearer <token>`

**Response:** PDF file download

---

## 💳 Payments

### Create Razorpay Order
**POST** `/payments/create-razorpay-order`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "orderId": "order_id_here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Razorpay order created successfully",
  "data": {
    "razorpayOrderId": "order_xyz123",
    "amount": 104400,
    "currency": "INR",
    "keyId": "rzp_test_..."
  }
}
```

### Verify Razorpay Payment
**POST** `/payments/verify-razorpay-payment`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "razorpayOrderId": "order_xyz123",
  "razorpayPaymentId": "pay_abc789",
  "razorpaySignature": "signature_here",
  "orderId": "order_id_here"
}
```

### Handle Payment Failure
**POST** `/payments/payment-failed`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "orderId": "order_id_here",
  "error": {
    "description": "Payment failed due to insufficient balance"
  }
}
```

### Get Payment Details
**GET** `/payments/:orderId`

**Headers:** `Authorization: Bearer <token>`

### Get Payment History
**GET** `/payments/user/history`

**Headers:** `Authorization: Bearer <token>`

### Get All Payments (Admin)
**GET** `/payments/admin/all`

**Headers:** `Authorization: Bearer <admin-token>`

---

## 📊 Dashboard (Admin Only)

### Get Dashboard Stats
**GET** `/dashboard/stats`

**Headers:** `Authorization: Bearer <admin-token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalOrders": 150,
      "totalRevenue": 450000,
      "totalCustomers": 85,
      "pendingOrders": 12,
      "lowStockCount": 5,
      "todayOrders": 8,
      "todayRevenue": 24000,
      "ordersByStatus": [...]
    }
  }
}
```

### Get Monthly Revenue
**GET** `/dashboard/revenue/monthly?year=2024`

**Headers:** `Authorization: Bearer <admin-token>`

### Get Daily Revenue
**GET** `/dashboard/revenue/daily`

**Headers:** `Authorization: Bearer <admin-token>`

### Get Recent Orders
**GET** `/dashboard/orders/recent?limit=10`

**Headers:** `Authorization: Bearer <admin-token>`

### Get Low Stock Products
**GET** `/dashboard/products/low-stock`

**Headers:** `Authorization: Bearer <admin-token>`

### Get Top Selling Products
**GET** `/dashboard/products/top-selling?limit=10`

**Headers:** `Authorization: Bearer <admin-token>`

### Get Sales by Category
**GET** `/dashboard/sales/by-category`

**Headers:** `Authorization: Bearer <admin-token>`

### Get Customer Growth
**GET** `/dashboard/customers/growth?months=6`

**Headers:** `Authorization: Bearer <admin-token>`

### Get Payment Method Stats
**GET** `/dashboard/payments/methods`

**Headers:** `Authorization: Bearer <admin-token>`

---

## 🔌 Socket.io Events

### Connection
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token'
  }
});

socket.on('connected', (data) => {
  console.log('Connected:', data);
});
```

### Customer Events
```javascript
// Listen for order updates
socket.on('order_placed', (data) => {
  console.log('Order placed:', data);
});

socket.on('order_status_updated', (data) => {
  console.log('Order status updated:', data);
});

socket.on('payment_success', (data) => {
  console.log('Payment successful:', data);
});

socket.on('payment_failed', (data) => {
  console.log('Payment failed:', data);
});
```

### Admin Events
```javascript
// Listen for new orders
socket.on('new_order', (data) => {
  console.log('New order received:', data);
});

socket.on('order_cancelled', (data) => {
  console.log('Order cancelled:', data);
});
```

### Join Order Room
```javascript
socket.emit('join_order_room', orderId);
```

---

## ⚠️ Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## 🔒 Rate Limiting

- General API: 100 requests per 15 minutes
- Auth endpoints: 10 requests per 15 minutes

---

## 📝 Notes

1. All timestamps are in ISO 8601 format
2. Prices are in INR (Indian Rupees)
3. Razorpay amounts are in paise (multiply by 100)
4. File uploads use `multipart/form-data`
5. All successful responses have `success: true`
6. All error responses have `success: false`

---

**For more information, visit the GitHub repository or contact support.**
