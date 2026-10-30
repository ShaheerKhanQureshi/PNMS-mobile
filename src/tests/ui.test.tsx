import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PasswordField, Field, ErrorNotice } from "../components/ui";
import {
  validMR,
  changePasswordSchema,
  passwordSchema,
} from "../lib/validation";
describe("patient identifier policy", () => {
  it("accepts the backend default digit policy without numerical coercion", () => {
    const value = "0000012345";
    expect(validMR(value)).toBe(true);
    expect(value).toBe("0000012345");
  });
  it.each([
    "",
    "1234",
    "123456789012345678901",
    "https://example.com/12345",
    '{"mr":"12345"}',
    "12345\n",
    "abcde",
  ])("rejects unsupported payload %j", (value) => {
    expect(validMR(value)).toBe(false);
  });
});
describe("password policy", () => {
  it("requires a letter, digit and special character with 8 minimum characters", () => {
    expect(passwordSchema.safeParse("StrongValue1234!").success).toBe(true);
    expect(passwordSchema.safeParse("Ab1!xyz9").success).toBe(true);
    expect(passwordSchema.safeParse("NoDigitsAtAll!").success).toBe(false);
    expect(passwordSchema.safeParse("NoSpecial1234").success).toBe(false);
    expect(passwordSchema.safeParse("12345678!@").success).toBe(false);
    expect(passwordSchema.safeParse("Sh0rt!").success).toBe(false);
  });
  it("requires matching new passwords", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "current",
        newPassword: "StrongValue1234!",
        confirmPassword: "OtherValue1234!",
      }).success,
    ).toBe(false);
  });
});
describe("accessible controls", () => {
  it("toggles password visibility without changing its value", () => {
    render(<PasswordField name="password" defaultValue="synthetic" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("synthetic");
  });
  it("associates a validation error with its input", () => {
    render(
      <Field
        name="username"
        label="Staff username"
        error="Enter your username."
      />,
    );
    expect(screen.getByLabelText("Staff username")).toHaveAttribute(
      "aria-describedby",
      "username-error",
    );
    expect(screen.getByText("Enter your username.")).toHaveAttribute(
      "id",
      "username-error",
    );
  });
  it("renders text safely without injecting HTML", () => {
    render(<ErrorNotice error={new Error("<script>alert(1)</script>")} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "<script>alert(1)</script>",
    );
    expect(document.querySelector("script")).toBeNull();
  });
});
