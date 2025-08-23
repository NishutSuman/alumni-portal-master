require('dotenv').config();
const axios = require('axios');

class AuthStructureTest {
  constructor() {
    this.baseURL = `http://localhost:${process.env.PORT || 3000}`;
  }

  async testAuthStructure() {
    console.log('🔍 AUTHENTICATION STRUCTURE TEST');
    console.log('=====================================');
    console.log(`Base URL: ${this.baseURL}`);

    const testUser = {
      email: 'test@payment.com',
      password: 'TestPassword123!'
    };

    console.log('\n1️⃣ Testing Login with existing user...');
    try {
      const response = await axios.post(`${this.baseURL}/api/auth/login`, testUser, {
        validateStatus: () => true
      });

      console.log('📊 Login Response:');
      console.log('Status:', response.status);
      console.log('Headers:', response.headers['content-type']);
      console.log('Data Structure:');
      console.log(JSON.stringify(response.data, null, 2));

      if (response.status === 200) {
        console.log('\n🔍 Analyzing Response Structure:');
        
        // Check for token
        const possibleTokens = [
          response.data.accessToken,
          response.data.token,
          response.data.data?.accessToken,
          response.data.data?.token
        ];
        
        const token = possibleTokens.find(t => t);
        console.log('Token found:', !!token);
        if (token) {
          console.log('Token location:', 
            response.data.accessToken ? 'data.accessToken' :
            response.data.token ? 'data.token' :
            response.data.data?.accessToken ? 'data.data.accessToken' :
            response.data.data?.token ? 'data.data.token' : 'unknown'
          );
        }

        // Check for user info
        const possibleUsers = [
          response.data.user,
          response.data.data?.user,
          response.data.data
        ];
        
        const user = possibleUsers.find(u => u && u.id);
        console.log('User object found:', !!user);
        if (user) {
          console.log('User ID:', user.id);
          console.log('User location:', 
            response.data.user ? 'data.user' :
            response.data.data?.user ? 'data.data.user' :
            'data.data'
          );
        }

        // Test /me endpoint if we have a token
        if (token) {
          console.log('\n2️⃣ Testing /api/auth/me endpoint...');
          try {
            const meResponse = await axios.get(`${this.baseURL}/api/auth/me`, {
              headers: { 'Authorization': `Bearer ${token}` },
              validateStatus: () => true
            });

            console.log('📊 Me Response:');
            console.log('Status:', meResponse.status);
            console.log('Data Structure:');
            console.log(JSON.stringify(meResponse.data, null, 2));

            if (meResponse.status === 200) {
              const meUser = meResponse.data.user || meResponse.data.data?.user || meResponse.data;
              if (meUser && meUser.id) {
                console.log('✅ User ID from /me:', meUser.id);
                console.log('✅ User role:', meUser.role);
              }
            }
          } catch (error) {
            console.log('❌ /me endpoint error:', error.message);
          }
        }

      } else {
        console.log('❌ Login failed');
        console.log('Error details:', response.data);
      }

    } catch (error) {
      console.log('❌ Login request failed:', error.message);
    }

    console.log('\n3️⃣ Testing different endpoints for structure...');
    
    // Test auth endpoints to understand structure
    const endpoints = [
      '/api/auth/me',
      '/api/users/profile/1',
      '/health'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${this.baseURL}${endpoint}`, {
          validateStatus: () => true,
          timeout: 3000
        });
        
        console.log(`\n${endpoint}:`);
        console.log('Status:', response.status);
        if (response.status < 500) {
          console.log('Response keys:', Object.keys(response.data || {}));
        }
      } catch (error) {
        console.log(`\n${endpoint}: ERROR -`, error.message);
      }
    }

    console.log('\n✅ Authentication structure analysis complete!');
    console.log('\nℹ️ Use this information to understand your API response format');
  }
}

// Run test
if (require.main === module) {
  const tester = new AuthStructureTest();
  tester.testAuthStructure().catch(console.error);
}

module.exports = AuthStructureTest;