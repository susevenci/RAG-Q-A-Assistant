"""文档文本抽取：支持 .txt / .md / .csv / .pdf / .docx。"""
from pathlib import Path


def extract_text(file_path: Path) -> str:
    """根据文件后缀抽取纯文本，返回文本内容。"""
    suffix = file_path.suffix.lower()
    if suffix in (".txt", ".md", ".markdown", ".csv", ".json", ".log", ".py", ".js", ".ts"):
        return file_path.read_text(encoding="utf-8", errors="ignore")

    if suffix == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(file_path))
        return "\n\n".join((page.extract_text() or "") for page in reader.pages)

    if suffix == ".docx":
        import docx2txt

        return docx2txt.process(str(file_path))

    raise ValueError(f"不支持的文件类型: {suffix}")
