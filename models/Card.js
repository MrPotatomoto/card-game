// models/Card.js
import mongoose from "mongoose"
const { Schema, model } = mongoose

const cardSchema = new Schema({
  _id: String,
  octgn_id: String,
  card_number: String,
  name: String,
  fullName: String,
  title: { type: String, default: "" },
  style: {
    type: String,
    enum: [
      "Black",
      "Blue",
      "Namekian",
      "Non-Styled",
      "Orange",
      "Red",
      "Saiyan",
    ],
    default: "Freestyle",
  },
  type: {
    type: String,
    enum: [
      "Ally",
      "Dragon Ball",
      "Drill",
      "Energy Combat",
      "Event",
      "Mastery",
      "Personality",
      "Physical Combat",
      "Setup",
      "No Type",
    ],
    default: "No Type",
  },
  rarity: {
    type: String,
    enum: [
      "Common",
      "Uncommon",
      "Rare",
      "Ultra Rare",
      "Promo",
      "Dragon Rare",
      "Starter",
    ],
    default: "Promo",
  },
  set: String,
  card_level: { type: Number, default: 0 },
  pur: { type: Number, default: 0 },
  power_rating: { type: [Number], default: [] },
  text: String,
  limit_per_deck: { type: Number, default: 3 },
  img_url: String,
  errata: { type: Array, default: [] },
  rulings: { type: Array, default: [] },
  alignment: {
    type: String,
    enum: ["Hero", "Villain", "None"],
    default: "None",
  },
})

export default model("Card", cardSchema)
