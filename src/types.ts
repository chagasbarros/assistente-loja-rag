// Um pedaço (chunk) de documento da loja, já limpo e sem dados pessoais.
export interface Chunk {
  id: string; // formato "arquivo#posição", ex.: "faq.csv#3"
  source: string; // nome do arquivo de origem em datalake/raw
  position: number; // ordem do chunk dentro do arquivo (começa em 0)
  text: string;
}
