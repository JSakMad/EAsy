import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GoogleSignIn, SignOut } from "../components/auth-controls";
import { AccountNav } from "../components/account-nav";

const mocks = vi.hoisted(() => ({
  social: vi.fn(), signOut: vi.fn(), replace: vi.fn(), refresh: vi.fn(), session: vi.fn(),
}));
vi.mock("@/lib/auth-client", () => ({ authClient: {
  signIn: { social: mocks.social }, signOut: mocks.signOut, useSession: mocks.session,
} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

describe("Google sign-in", () => {
  it("disables sign-in when not configured", () => {
    render(<GoogleSignIn enabled={false} />);
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(mocks.social).not.toHaveBeenCalled();
  });
  it("uses fixed local callbacks and prevents duplicate submissions", async () => {
    mocks.social.mockResolvedValue({ data: { url: "https://accounts.google.com" }, error: null });
    render(<GoogleSignIn enabled />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(mocks.social).toHaveBeenCalledWith({
      provider: "google", callbackURL: "/account", newUserCallbackURL: "/account", errorCallbackURL: "/sign-in?error=oauth",
    }));
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
  it.each(["provider", "network"])("allows retry after a %s failure", async (failure) => {
    if (failure === "provider") mocks.social.mockResolvedValue({ error: { message: "private provider detail" } });
    else mocks.social.mockRejectedValue(new Error("private network detail"));
    render(<GoogleSignIn enabled />);
    fireEvent.click(screen.getByRole("button"));
    expect((await screen.findByRole("alert")).textContent).toContain("Please try again");
    expect(screen.queryByText(/private/)).toBeNull();
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  });
  it("explains cancellation on return from Google", () => {
    render(<GoogleSignIn enabled failed />);
    expect(screen.getByRole("alert").textContent).toContain("not completed");
  });
});

describe("sign-out and navigation", () => {
  it("refreshes server state only after successful sign-out", async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    render(<SignOut />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/sign-in"));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it("does not pretend the user signed out when revocation fails", async () => {
    mocks.signOut.mockResolvedValue({ error: { message: "database unavailable" } });
    render(<SignOut />);
    fireEvent.click(screen.getByRole("button"));
    await screen.findByRole("alert");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  });
  it("shows loading then account navigation for an authenticated user", () => {
    mocks.session.mockReturnValue({ isPending: true });
    const { rerender } = render(<AccountNav />);
    expect(screen.getByRole("status")).toBeTruthy();
    mocks.session.mockReturnValue({ isPending: false, data: { user: { name: "Student" } } });
    rerender(<AccountNav />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/account");
  });
  it("offers sign-in for expired sessions and session errors", () => {
    mocks.session.mockReturnValue({ isPending: false, data: null });
    const { rerender } = render(<AccountNav />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/sign-in");
    mocks.session.mockReturnValue({ isPending: false, data: { user: {} }, error: { status: 503 } });
    rerender(<AccountNav />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/sign-in");
  });
});
