// models/Deck.js
import mongoose from "mongoose"
const { Schema, model } = mongoose

const DeckSchema = new Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  cards: [
    {
      card: { type: String, ref: "Card" }, // Card _id is a string in your schema.
      quantity: { type: Number, default: 1 },
    },
  ],
})

export default model("Deck", DeckSchema)
