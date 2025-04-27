// models/ChatMessage.js
import mongoose from "mongoose"
const { Schema, model } = mongoose

const ChatMessageSchema = new Schema({
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GameSession",
    required: true,
  },
  user: { type: String, required: true },
  message: { type: String, required: true },
  time: { type: Date, default: Date.now },
})

export default model("ChatMessage", ChatMessageSchema)
