const admin = require('firebase-admin');
const path = require('path');

// Cette version du fichier utilise TOUJOURS le fichier de service account local.
// La méthode par variables d'environnement a été retirée pour plus de simplicité.

try {
  // On construit le chemin vers le fichier de clé
  const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
  
  // On charge le fichier
  const serviceAccount = require(serviceAccountPath);

  // Vérification simple pour s'assurer que le fichier est valide
  if (!serviceAccount.project_id) {
    throw new Error('Le fichier firebase-service-account.json est invalide ou ne contient pas de "project_id".');
  }

  // Initialisation de Firebase avec les identifiants du fichier
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('✅ Firebase initialisé avec le fichier local firebase-service-account.json');

} catch (error) {
  // Message d'erreur amélioré pour guider l'utilisateur
  console.error('❌ Erreur critique lors de l\'initialisation de Firebase.');
  console.error('   Message:', error.message);
  console.error('\n💡 VÉRIFIEZ BIEN LES POINTS SUIVANTS :');
  console.error('   1. Un fichier nommé "firebase-service-account.json" existe bien.');
  console.error('   2. Il est placé dans le même dossier que ce fichier (back/config/).');
  console.error('   3. Le fichier JSON que vous avez téléchargé de Firebase est complet et valide.');
  
  // On arrête le processus car l'application ne peut pas fonctionner sans Firebase
  process.exit(1); 
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { db, auth, admin };