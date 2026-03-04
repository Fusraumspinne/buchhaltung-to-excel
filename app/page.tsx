"use client"

import { useState } from 'react'
import * as ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { Plus, Download, Trash2, FileSpreadsheet, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface ProductRow {
  id: string;
  datum: string;
  produkt: string;
  groesse: string;
  verkaufspreis: number;
  einkaufspreis: number;
}

export default function Home() {
  const [rows, setRows] = useState<ProductRow[]>([
    { id: crypto.randomUUID(), datum: new Date().toISOString().split('T')[0], produkt: '', groesse: 'M', verkaufspreis: 0, einkaufspreis: 0 }
  ])
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const hasEmptyRow = rows.some(row => row.produkt.trim() === '' && row.verkaufspreis === 0 && row.einkaufspreis === 0)

  const addRow = () => {
    if (!hasEmptyRow) {
      setRows([{ id: crypto.randomUUID(), datum: new Date().toISOString().split('T')[0], produkt: '', groesse: 'M', verkaufspreis: 0, einkaufspreis: 0 }, ...rows])
      setCurrentPage(1)
    }
  }

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter(row => row.id !== id))
    }
  }

  const updateRow = (id: string, field: keyof ProductRow, value: string | number) => {
    setRows(rows.map(row => row.id === id ? { ...row, [field]: value } : row))
  }

  const totalUmsatz = rows.reduce((sum, row) => sum + row.verkaufspreis, 0)
  const totalAusgaben = rows.reduce((sum, row) => sum + row.einkaufspreis, 0)
  const totalGewinn = totalUmsatz - totalAusgaben

  const sortedRows = [...rows].sort((a, b) => {
    const aEmpty = a.produkt.trim() === '' && a.verkaufspreis === 0 && a.einkaufspreis === 0
    const bEmpty = b.produkt.trim() === '' && b.verkaufspreis === 0 && b.einkaufspreis === 0
    if (aEmpty && !bEmpty) return -1
    if (!aEmpty && bEmpty) return 1
    return new Date(b.datum).getTime() - new Date(a.datum).getTime()
  })
  
  const totalPages = Math.ceil(sortedRows.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedRows = sortedRows.slice(startIndex, startIndex + itemsPerPage)

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Verkäufe')

    worksheet.columns = [
      { header: 'Datum', key: 'datum', width: 15 },
      { header: 'Produkt', key: 'produkt', width: 25 },
      { header: 'Größe', key: 'groesse', width: 10 },
      { header: 'Verkaufspreis (€)', key: 'verkaufspreis', width: 15 },
      { header: 'Einkaufspreis (€)', key: 'einkaufspreis', width: 15 }
    ]

    const validRows = sortedRows.filter(row => 
      row.produkt.trim() !== '' && 
      (row.verkaufspreis > 0 || row.einkaufspreis > 0)
    )

    validRows.forEach((row, index) => {
      const rowNum = index + 2
      worksheet.addRow({
        datum: row.datum,
        produkt: row.produkt,
        groesse: row.groesse,
        verkaufspreis: row.verkaufspreis,
        einkaufspreis: row.einkaufspreis,
      })

      worksheet.getCell(`D${rowNum}`).numFmt = '#,##0.00'
      worksheet.getCell(`E${rowNum}`).numFmt = '#,##0.00'
    })

    const footerRowNum = validRows.length + 3
    worksheet.getCell(`C${footerRowNum}`).value = 'GESAMT:'
    worksheet.getCell(`C${footerRowNum}`).font = { bold: true }
    
    worksheet.getCell(`D${footerRowNum}`).value = { formula: `SUM(D2:D${validRows.length + 1})`, result: totalUmsatz }
    worksheet.getCell(`E${footerRowNum}`).value = { formula: `SUM(E2:E${validRows.length + 1})`, result: totalAusgaben }
    
    const profitRowNum = footerRowNum + 1
    worksheet.getCell(`C${profitRowNum}`).value = 'GEWINN:'
    worksheet.getCell(`C${profitRowNum}`).font = { bold: true }
    worksheet.getCell(`D${profitRowNum}`).value = { formula: `D${footerRowNum}-E${footerRowNum}`, result: totalGewinn }
    
    const footerCells = [`D${footerRowNum}`, `E${footerRowNum}`, `D${profitRowNum}`]
    footerCells.forEach(cell => {
      worksheet.getCell(cell).numFmt = '#,##0.00'
      worksheet.getCell(cell).font = { bold: true }
    })

    worksheet.getRow(1).font = { bold: true }
    
    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), 'buchhaltung.xlsx')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const workbook = new ExcelJS.Workbook()
      const arrayBuffer = await file.arrayBuffer()
      await workbook.xlsx.load(arrayBuffer as any)
      const worksheet = workbook.getWorksheet(1)
      
      if (worksheet) {
        const newRows: ProductRow[] = []
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return
          
          newRows.push({
            id: crypto.randomUUID(),
            datum: row.getCell(1).text || new Date().toISOString().split('T')[0],
            produkt: row.getCell(2).text || '',
            groesse: row.getCell(3).text || 'M',
            verkaufspreis: Number(row.getCell(4).value) || 0,
            einkaufspreis: Number(row.getCell(5).value) || 0,
          })
        })
        if (newRows.length > 0) {
          const cleanedRows = newRows.filter(row => 
            row.produkt.trim() !== '' || row.verkaufspreis !== 0 || row.einkaufspreis !== 0
          )
          
          const finalRows = [
            {
              id: crypto.randomUUID(),
              datum: new Date().toISOString().split('T')[0],
              produkt: '',
              groesse: 'M',
              verkaufspreis: 0,
              einkaufspreis: 0,
            },
            ...cleanedRows
          ]
          
          setRows(finalRows)
          setCurrentPage(1)
        }
      }
    } catch (error) {
      console.error("Fehler beim Laden:", error)
      alert("Fehler beim Lesen der Excel-Datei.")
    }
    e.target.value = ''
  }

  return (
    <div className="min-h-screen p-4 md:p-6 bg-white text-slate-900 font-sans">
      <div className="max-w-5xl mx-auto border-x border-slate-100 sm:px-4">
        <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center mb-8 gap-4 pt-4">
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 tracking-tight">
            <FileSpreadsheet className="text-blue-500 w-5 h-5" /> BUCHHALTUNG
          </h1>
          <div className="flex gap-2">
            <label className="cursor-pointer bg-white hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded border border-slate-200 text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm">
              <Download className="w-3.5 h-3.5 rotate-180" /> Import
              <input type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} />
            </label>
            <button
              onClick={exportToExcel}
              className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-slate-200 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-slate-50/50 border-b-2 border-slate-100 rounded-t p-3 transition-all">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">Umsatz</p>
            <p className="text-xl font-black text-slate-900">{totalUmsatz.toFixed(2)}€</p>
          </div>
          <div className="bg-slate-50/50 border-b-2 border-slate-100 rounded-t p-3 transition-all">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">Ausgaben</p>
            <p className="text-xl font-black text-slate-900">{totalAusgaben.toFixed(2)}€</p>
          </div>
          <div className={`border-b-2 rounded-t p-3 transition-all ${totalGewinn >= 0 ? 'bg-green-50/30 border-green-200' : 'bg-red-50/30 border-red-200'}`}>
            <p className={`text-[10px] uppercase font-bold mb-1 tracking-widest ${totalGewinn >= 0 ? 'text-green-600' : 'text-red-600'}`}>Gewinn</p>
            <p className={`text-xl font-black ${totalGewinn >= 0 ? 'text-green-700' : 'text-red-700'}`}>{totalGewinn.toFixed(2)}€</p>
          </div>
        </div>

        <div className="bg-white border-t border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-4 py-3 w-32">Datum</th>
                  <th className="px-4 py-3">Produkt</th>
                  <th className="px-4 py-3 w-24">Größe</th>
                  <th className="px-4 py-3 w-28 text-right">Verkauf</th>
                  <th className="px-4 py-3 w-28 text-right">Einkauf</th>
                  <th className="px-4 py-3 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={row.datum}
                        onChange={(e) => updateRow(row.id, 'datum', e.target.value)}
                        className="w-full bg-transparent p-1 text-xs border border-transparent focus:border-slate-100 rounded outline-none cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.produkt}
                        placeholder="Pullover, T-Shirt..."
                        onChange={(e) => updateRow(row.id, 'produkt', e.target.value)}
                        className="w-full bg-transparent p-1 text-xs border border-transparent focus:border-slate-100 rounded outline-none"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={row.groesse}
                        onChange={(e) => updateRow(row.id, 'groesse', e.target.value)}
                        className="w-full bg-transparent p-1 text-xs cursor-pointer border border-transparent focus:border-slate-100 rounded outline-none appearance-none hover:text-blue-600"
                      >
                        {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={row.verkaufspreis === 0 ? '' : row.verkaufspreis}
                        placeholder="0.00"
                        onChange={(e) => updateRow(row.id, 'verkaufspreis', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        className="w-20 bg-transparent p-1 text-xs text-right border border-transparent focus:border-slate-100 rounded outline-none"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={row.einkaufspreis === 0 ? '' : row.einkaufspreis}
                        placeholder="0.00"
                        onChange={(e) => updateRow(row.id, 'einkaufspreis', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        className="w-20 bg-transparent p-1 text-xs text-right border border-transparent focus:border-slate-100 rounded outline-none"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => removeRow(row.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 gap-4 bg-slate-50/30 border-t border-slate-100">
            <button
              onClick={addRow}
              className="group flex items-center gap-1.5 text-slate-400 hover:text-slate-900 text-[10px] font-black uppercase tracking-widest outline-none transition-all cursor-pointer"
            >
              <div className="bg-slate-100 group-hover:bg-slate-200 p-1 rounded transition-colors">
                <Plus className="w-3 h-3" />
              </div> 
              Hinzufügen
            </button>
            
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setCurrentPage(1)} 
                  disabled={currentPage === 1}
                  className="p-1.5 rounded hover:bg-white text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-all border border-transparent hover:border-slate-200"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                  disabled={currentPage === 1}
                  className="p-1.5 rounded hover:bg-white text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-all border border-transparent hover:border-slate-200"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center text-[10px] font-black text-slate-400 tracking-tighter mx-2">
                  <span className="text-slate-900">{currentPage}</span>
                  <span className="mx-1">/</span>
                  <span>{totalPages}</span>
                </div>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded hover:bg-white text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-all border border-transparent hover:border-slate-200"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setCurrentPage(totalPages)} 
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded hover:bg-white text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-all border border-transparent hover:border-slate-200"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}