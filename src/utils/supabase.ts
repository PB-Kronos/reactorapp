import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// User management functions
export const getUser = async (username: string) => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("name", username);
  return data?.[0];
};

export const verifyPassword = async (username: string, password: string) => {
  const user = await getUser(username);
  if (!user) return false;
  // Add password hashing logic here (bcrypt or similar)
  return user.password === password; // Simplified for example
};

// Commands management functions
export const getCommands = async () => {
  const { data, error } = await supabase
    .from("commands")
    .select("*");
  return data;
};

export const executeCommand = async (input: string) => {
  const { data, error } = await supabase
    .from("commands")
    .select("output, extra")
    .eq("input", input);
  return data?.[0] || null;
};