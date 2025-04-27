// models/User.js
import mongoose from "mongoose"
import bcrypt from "bcrypt"

const { Schema, model } = mongoose
const SALT_WORK_FACTOR = 10

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String },
})

// Use a regular function (not an arrow function) to preserve the context of `this`
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()
  try {
    const salt = await bcrypt.genSalt(SALT_WORK_FACTOR)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (err) {
    next(err)
  }
})

// Method to compare password during login
UserSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

export default model("User", UserSchema)
