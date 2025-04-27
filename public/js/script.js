const convertToPathString = (sample) => {
  if (!sample) return
  sample = sample.split(" ").splice("-").toLowerCase()
  return sample
}
