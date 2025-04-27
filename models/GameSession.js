// models/GameSession.js
import mongoose from "mongoose"
const { Schema, model } = mongoose

const GameSessionSchema = new Schema({
  name: { type: String, required: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["waiting", "in-progress", "finished"],
    default: "waiting",
  },
  createdAt: { type: Date, default: Date.now },
})

export default model("GameSession", GameSessionSchema)
