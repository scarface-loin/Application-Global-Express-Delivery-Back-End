// ==================== scripts/test-login.js ====================
// Script pour tester le login directement

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Différents tests de login
const tests = [
  {
    name: 'Login avec téléphone simple',
    data: {
      phone: '622112298',
      password: 'matricule123'
    }
  },
];

async function testLogin(test) {
  console.log(`\n🧪 Test: ${test.name}`);
  console.log('📤 Données envoyées:', JSON.stringify(test.data, null, 2));
  
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, test.data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ SUCCÈS!');
    console.log('📥 Réponse:', {
      token: response.data.token ? '***TOKEN***' : 'absent',
      user: response.data.user?.name || 'absent',
      mustChangePassword: response.data.mustChangePassword
    });
    
  } catch (error) {
    console.log('❌ ÉCHEC');
    
    if (error.response) {
      console.log('📥 Statut:', error.response.status);
      console.log('📥 Erreur:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('❌ Pas de réponse du serveur');
      console.log('   Le serveur est-il démarré?');
    } else {
      console.log('❌ Erreur:', error.message);
    }
  }
}

async function runAllTests() {
  console.log('🚀 Démarrage des tests de login...');
  console.log('🌐 URL:', BASE_URL);
  console.log('='.repeat(60));
  
  for (const test of tests) {
    await testLogin(test);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ Tests terminés');
}

// Exécuter
runAllTests().catch(error => {
  console.error('💥 Erreur fatale:', error);
  process.exit(1);
});

// ==================== Installation ====================
// Pour utiliser ce script:
// 1. Installez axios: npm install axios
// 2. Assurez-vous que le serveur tourne: npm run dev
// 3. Exécutez: node scripts/test-login.js