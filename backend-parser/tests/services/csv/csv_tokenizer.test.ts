import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../services/csv/csv_tokenizer";

describe("parseCsvText", () => {
  it("usa ';' como delimitador quando o cabeçalho tem ';'", () => {
    expect(parseCsvText("data;descricao;valor\n01/03/2026;Padaria;10,50")).toEqual({
      headers: ["data", "descricao", "valor"],
      rows: [["01/03/2026", "Padaria", "10,50"]],
    });
  });

  it("usa ',' como delimitador quando o cabeçalho não tem ';'", () => {
    expect(parseCsvText("date,title,amount\n2026-03-01,Padaria,10.5")).toEqual({
      headers: ["date", "title", "amount"],
      rows: [["2026-03-01", "Padaria", "10.5"]],
    });
  });

  it("remove o BOM do início", () => {
    expect(parseCsvText("﻿data;valor\n01/03/2026;1").headers).toEqual(["data", "valor"]);
  });

  it("trata CRLF, LF e CR da mesma forma", () => {
    const expected = parseCsvText("a;b\n1;2\n3;4");

    expect(parseCsvText("a;b\r\n1;2\r\n3;4")).toEqual(expected);
    expect(parseCsvText("a;b\r1;2\r3;4")).toEqual(expected);
  });

  it("lê campos entre aspas com delimitador, aspas escapadas e quebra de linha", () => {
    const { rows } = parseCsvText('a;b\n"Loja; Centro";"Diz ""oi""\nsegunda linha"');

    expect(rows).toEqual([["Loja; Centro", 'Diz "oi"\nsegunda linha']]);
  });

  it("ignora linhas vazias", () => {
    expect(parseCsvText("a;b\n\n1;2\n\n").rows).toEqual([["1", "2"]]);
  });

  it("falha com CSV vazio", () => {
    expect(() => parseCsvText("")).toThrow("CSV vazio ou sem cabeçalho.");
    expect(() => parseCsvText("\n\n")).toThrow("CSV vazio ou sem cabeçalho.");
  });
});
