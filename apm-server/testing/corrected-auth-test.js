// testing/corrected-auth-test.js
// CORRECTED Auth Structure Test using actual seeded users

require('dotenv').config();
const axios = require('axios');
const colors = require('colors');

class CorrectedAuthTest {
  constructor() {
    this.baseURL = `http://localhost:${process.env.PORT || 3000}`;
  }

  async testAuthStructure() {
    console.log('🔍 CORRECTED AUTHENTICATION STRUCTURE TEST'.cyan.bold);
    console.log('=====================================');
    console.log(`Base URL: ${this.baseURL}`);

    // CORRECTED: Use actual seeded user emails
    const testUsers = [
      { email: 'admin@test.com', password: 'TestPassword123!', role: 'SUPER_ADMIN' },
      { email: 'user@test.com', password: 'TestPassword123!', role: 'USER' },
      { email: 'batchadmin2020@test.com', password: 'TestPassword123!', role: 'USER' }
    ];

    for (const testUser of testUsers) {
      console.log(`\n🧪 Testing Login: ${testUser.email} (${testUser.role})`.blue.bold);
      
      try {
        const response = await axios.post(`${this.baseURL}/api/auth/login`, {
          email: testUser.email,
          password: testUser.password
        }, {
          validateStatus: () => true
        });

        console.log(`📊 Login Response for ${testUser.email}:`.yellow);
        console.log('Status:', response.status);
        console.log('Headers:', response.headers['content-type']);
        console.log('Data Structure:');
        console.log(JSON.stringify(response.data, null, 2));

        if (response.status === 200) {
          console.log('\n🔍 Analyzing Response Structure:'.green);
          
          // Check for token in various possible locations
          const possibleTokens = [
            response.data.accessToken,
            response.data.token,
            response.data.data?.accessToken,
            response.data.data?.token,
            response.data.data?.tokens?.accessToken,
            response.data.tokens?.accessToken
          ];
          
          const token = possibleTokens.find(t => t);
          console.log('✅ Token found:', !!token);
          if (token) {
            console.log('✅ Token location:', 
              response.data.accessToken ? 'data.accessToken' :
              response.data.token ? 'data.token' :
              response.data.data?.accessToken ? 'data.data.accessToken' :
              response.data.data?.token ? 'data.data.token' :
              response.data.data?.tokens?.accessToken ? 'data.data.tokens.accessToken' :
              response.data.tokens?.accessToken ? 'data.tokens.accessToken' : 'unknown'
            );
            console.log('✅ Token preview:', token.substring(0, 50) + '...');
          }

          // Check for user info in various locations
          const possibleUsers = [
            response.data.user,
            response.data.data?.user,
            response.data.data
          ];
          
          const user = possibleUsers.find(u => u && u.id);
          console.log('✅ User object found:', !!user);
          if (user) {
            console.log('✅ User ID:', user.id);
            console.log('✅ User Role:', user.role);
            console.log('✅ User Email:', user.email);
            console.log('✅ User location:', 
              response.data.user ? 'data.user' :
              response.data.data?.user ? 'data.data.user' :
              'data.data'
            );
          }

          // Test /me endpoint if we have a token
          if (token) {
            console.log('\n🧪 Testing /api/auth/me endpoint...'.blue);
            try {
              const meResponse = await axios.get(`${this.baseURL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` },
                validateStatus: () => true
              });

              console.log('📊 /me Response:');
              console.log('Status:', meResponse.status);
              console.log('Data Structure:');
              console.log(JSON.stringify(meResponse.data, null, 2));

            } catch (error) {
              console.log('❌ /me endpoint error:', error.message);
            }
          }

        } else {
          console.log('❌ Login failed'.red);
          console.log('Error details:', response.data);
        }

      } catch (error) {
        console.log('❌ Login request failed:', error.message);
      }
      
      console.log('─'.repeat(50).gray);
    }

    console.log('\n✅ Authentication structure analysis complete!'.green.bold);
    console.log('\nℹ️ This shows us your exact API response format'.blue);
  }
}

// Run test
if (require.main === module) {
  const tester = new CorrectedAuthTest();
  tester.testAuthStructure().catch(console.error);
}

module.exports = CorrectedAuthTest;