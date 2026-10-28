import { getChatGPTUser } from "../../app/chatgpt-auth";
import { HttpError } from "./security";
export async function owner() {
  const user = await getChatGPTUser();
  if (!user)
    throw new HttpError(401, "Sign in with ChatGPT to open your studio.");
  return user;
}
