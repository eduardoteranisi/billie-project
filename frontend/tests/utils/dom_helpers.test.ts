import { afterEach, describe, expect, it, vi } from "vitest";
import { escapeHtmlSpecialCharacters, getRequiredElementById } from "../../utils/dom_helpers";

function stubDocumentWithElements(elementsById: Record<string, object>): void {
  vi.stubGlobal("document", {
    getElementById: (id: string) => elementsById[id] ?? null,
  });
}

describe("getRequiredElementById", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devolve o elemento com o id informado", () => {
    const botao = { id: "btn-tema" };
    stubDocumentWithElements({ "btn-tema": botao });

    expect(getRequiredElementById<HTMLButtonElement>("btn-tema")).toBe(botao);
  });

  it("lança erro quando o elemento não existe", () => {
    stubDocumentWithElements({});

    expect(() => getRequiredElementById("inexistente")).toThrow("elemento #inexistente não encontrado");
  });
});

describe("escapeHtmlSpecialCharacters", () => {
  it("escapa os cinco caracteres especiais do HTML", () => {
    expect(escapeHtmlSpecialCharacters(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;"
    );
  });

  it("mantém texto sem caracteres especiais inalterado", () => {
    expect(escapeHtmlSpecialCharacters("Padaria São João 123")).toBe("Padaria São João 123");
  });
});
