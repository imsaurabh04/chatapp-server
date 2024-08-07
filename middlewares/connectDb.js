import mongoose from "mongoose";

const connectDb = async (uri) => {

    try {
        if (!mongoose.connections[0].readyState) {
            const db = await mongoose.connect(uri, { dbName: "ChatterBox" });
            console.log(`Database is connected with ${db.connection.host}`);
        }

    } catch (error) {
        throw error;
    }
}

export default connectDb;