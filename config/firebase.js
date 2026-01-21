const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Version optimisée pour Render avec Secret Files

try {
  let serviceAccount;
  
  // Cherche d'abord dans /etc/secrets/ (emplacement Render pour Secret Files)
  const renderSecretsPath = '/etc/secrets/firebase-service-account.json';
  
  if (fs.existsSync(renderSecretsPath)) {
    // Mode Render avec Secret Files
    console.log('🔐 Chargement depuis Render Secret Files...');
    const serviceAccountData = fs.readFileSync(renderSecretsPath, 'utf8');
    serviceAccount = JSON.parse(serviceAccountData);
  } 
  // Fallback pour développement local
  else {
    console.log('💻 Mode développement - Chargement depuis le fichier local...');
    const localPath = path.join(__dirname, 'firebase-service-account.json');
    
    if (fs.existsSync(localPath)) {
      serviceAccount = require(localPath);
    } else {
      throw new Error('Aucun fichier de configuration Firebase trouvé. Vérifiez :\n' +
        '1. En production: Ajoutez "firebase-service-account.json" dans Render Secret Files\n' +
        '2. En développement: Placez firebase-service-account.json dans le dossier config/');
    }
  }

  // Vérification du service account
  if (!serviceAccount.project_id) {
    throw new Error('Le fichier de service account Firebase est invalide (project_id manquant).');
  }

  // Initialisation de Firebase
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log(`✅ Firebase initialisé avec succès (Projet: ${serviceAccount.project_id})`);

} catch (error) {
  console.error('❌ ERREUR FATALE: Impossible d\'initialiser Firebase');
  console.error('Message:', error.message);
  
  console.error('\n🔧 CONFIGURATION REQUISE:');
  console.error('========================================');
  console.error('EN PRODUCTION (Render):');
  console.error('1. Allez dans votre service sur Render');
  console.error('2. Cliquez sur "Environment"');
  console.error('3. Cliquez sur "Secret Files"');
  console.error('4. Ajoutez un fichier nommé EXACTEMENT:');
  console.error('   Nom: firebase-service-account.json');
  console.error('   Contenu: Votre fichier JSON complet depuis Firebase Console');
  console.error('\nEN DÉVELOPPEMENT:');
  console.error('1. Placez firebase-service-account.json dans /back/config/');
  console.error('   OU');
  console.error('2. Utilisez les variables d\'environnement (voir documentation)');
  
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { db, auth, admin };