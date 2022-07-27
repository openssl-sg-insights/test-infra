const landCheckPilotGroup = new Set([
  "landchecktestuser",
  "zengk95",
  "atalman",
  "clee2000",
  "huydhn",
  "izaitsevfb",
  "mehtanirav",
  "weiwangmeta",
  "ZainRizvi",
  "janeyx99",
  "DanilBaibak",
  "jeanschmidt",
  "osalpekar",
  "malfet",
  "kit1980",
]);

export const POSSIBLE_USERS = [
  "swang392", 
  "janeyx99", 
  "atalman", 
  "clee2000", 
  "seemethere",
  "huydhn", 
  "zengk95", 
  "linbinyu", 
  "suo", 
  "dagitses", 
  "malfet", 
  "mehtanirav", 
  "kit1980",
  "b0noI", 
  "weiwangmeta", 
  "ZainRizvi", 
  "DanilBaibak", 
  "jeanschmidt", 
  "osalpekar"];

export function isInLandCheckAllowlist(username: string) {
  return landCheckPilotGroup.has(username);
}
