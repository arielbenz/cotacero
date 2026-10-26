import PDFKit
import Foundation
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let doc = PDFDocument(url: url) else { print("no abre"); exit(1) }
var total = 0
for i in 0..<doc.pageCount {
  let t = doc.page(at: i)?.string ?? ""
  total += t.count
  print("=== página \(i+1) (\(t.count) caracteres)")
  print(t)
}
print("TOTAL \(total)")
