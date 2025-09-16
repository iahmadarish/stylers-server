import { MongoClient } from "mongodb";

const uri = "mongodb+srv://stylersoutfit:JvsZ68lDMaAHMOe1@cluster0.fogeg0e.mongodb.net/stylersdatabase?retryWrites=true&w=majority&appName=Cluster0";
const dbName = "stylersdatabase"; // <-- তোমার ডেটাবেইজের নাম

const client = new MongoClient(uri);

async function migrateProducts() {
  try {
    await client.connect();
    const db = client.db(dbName);
    const products = db.collection("products");

    const cursor = products.find({});

    while (await cursor.hasNext()) {
      const product = await cursor.next();

      if (product.images && product.images.length > 0 && !product.colorVariants) {
        const updatedFields = {
          colorVariants: [{
            name: "Default",
            code: "#000000",
            images: product.images,
            stock: product.stock || 0
          }],
          hasColorVariants: true
        };

        await products.updateOne(
          { _id: product._id },
          { $set: updatedFields }
        );

        console.log(`✅ Migrated product: ${product._id}`);
      }
    }

    console.log("🎉 Migration complete.");
  } catch (err) {
    console.error("❌ Error during migration:", err);
  } finally {
    await client.close();
  }
}

migrateProducts();
