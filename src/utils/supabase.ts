import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ysuzhwluulxwdiyopvno.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzdXpod2x1dWx4d2RpeW9wdm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMjc5NDAsImV4cCI6MjA4ODgwMzk0MH0.iwRiW7QtA3S_rsEn4uCenXKcyCgXbOwlm3Ik5C42UBY";

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