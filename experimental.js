// Method 1: Using Node.js crypto module
const crypto = require('crypto');

// Generate a 64-byte random string
const generateSecret1 = () => {
  return crypto.randomBytes(64).toString('hex');
};

// Method 2: Using Node.js crypto with base64
const generateSecret2 = () => {
  return crypto.randomBytes(32).toString('base64');
};

// Method 3: Using UUID v4 combination for extra uniqueness
const generateSecret3 = () => {
  return crypto.randomUUID() + crypto.randomBytes(32).toString('hex');
};

// Method 4: Using a combination of timestamp and random bytes
const generateSecret4 = () => {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(32).toString('hex');
  return `${timestamp}.${random}`;
};

// Example usage
console.log('Method 1:', generateSecret1());
console.log('Method 2:', generateSecret2());
console.log('Method 3:', generateSecret3());
console.log('Method 4:', generateSecret4());