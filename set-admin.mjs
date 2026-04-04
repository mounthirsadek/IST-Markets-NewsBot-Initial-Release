import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

// Load firebase config
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

admin.initializeApp({ projectId: firebaseConfig.projectId });
const db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);
const authClient = admin.auth();

const EMAIL = "mert@istrealestate.ae";

async function run() {
  try {
    // Get user by email
    const userRecord = await authClient.getUserByEmail(EMAIL);
    const uid = userRecord.uid;
    console.log(`Found user: ${uid}`);

    // Set role in Firestore
    await db.collection("users").doc(uid).set({
      uid,
      email: EMAIL,
      displayName: userRecord.displayName || "Mert Sadek",
      role: "super-admin",
      two_factor_enabled: false,
      createdAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`✅ Role 'super-admin' set for ${EMAIL}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

run();
