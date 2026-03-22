import { Role } from "@/types/mimo";

export const ROLE_COLOR: Record<Role, string> = {
  assistant: "green",
  meta: "gray",
  system: "yellow",
  user: "magenta",
};

export const ROLE_LABEL: Record<Role, string> = {
  assistant: "MiMo",
  meta: "",
  system: "System",
  user: "You",
};
