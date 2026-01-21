// scripts/reset-admin-password.js
require('dotenv').config();
const { db } = require('../config/firebase');
const bcrypt = require('bcryptjs');

async function resetAdminPassword() {
  console.log('🔄 Réinitialisation du mot de passe admin...\n');

  const phone = process.argv[2];
  const newPassword = process.argv[3];

  if (!phone || !newPassword) {
    console.log('❌ Usage: node scripts/reset-admin-password.js <téléphone> <nouveau_mot_de_passe>');
    console.log('   Exemple: node scripts/reset-admin-password.js 237670000000 "Admin2024!"\n');
    process.exit(1);
  }

  try {
    // Trouver l'utilisateur
    console.log(`📱 Recherche de l'utilisateur: ${phone}`);
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('phone', '==', phone).limit(1).get();

    if (snapshot.empty) {
      console.log('❌ Aucun utilisateur trouvé avec ce numéro\n');
      
      // Lister les utilisateurs disponibles
      console.log('📋 Utilisateurs disponibles:');
      const allUsers = await usersRef.get();
      allUsers.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${data.name} (${data.phone}) - ${data.role}`);
      });
      console.log('');
      process.exit(1);
    }

    const userDoc = snapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    console.log(`✅ Utilisateur trouvé: ${userData.name}`);
    console.log(`   ID: ${userId}`);
    console.log(`   Rôle: ${userData.role}\n`);

    // Hasher le nouveau mot de passe
    console.log('🔐 Hachage du nouveau mot de passe...');
    const hash = await bcrypt.hash(newPassword, 10);

    // Mettre à jour
    console.log('💾 Mise à jour dans Firestore...');
    await db.collection('passwords').doc(userId).set({
      hash: hash,
      updatedAt: new Date()
    }, { merge: true });

    // Retirer le flag mustChangePassword si présent
    await db.collection('users').doc(userId).update({
      mustChangePassword: false,
      updatedAt: new Date()
    });

    console.log('\n✅ Mot de passe réinitialisé avec succès!');
    console.log('\n🔑 Nouvelles credentials:');
    console.log(`   Téléphone: ${phone}`);
    console.log(`   Mot de passe: ${newPassword}`);
    console.log('\n✨ Vous pouvez maintenant vous connecter!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

resetAdminPassword();