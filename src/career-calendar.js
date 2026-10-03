// career.day stays the voyage's departure date until the next harbour day.
// Event dates must also include any midnights crossed by its unbounded trip clock.
export function careerDayAt(w, minute = w.day?.minute ?? 0) {
  return (w.career?.day ?? 1) + Math.floor((Math.max(0, minute) + 1e-7) / 1440);
}
