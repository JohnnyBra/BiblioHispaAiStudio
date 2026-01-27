import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { User, Transaction, Book } from '../types';

export const generateStudentLoanReport = (
  user: User,
  transactions: Transaction[],
  books: Book[],
  period: 'monthly' | 'quarterly' | 'annual',
  schoolName: string,
  logoUrl?: string
) => {
  const doc = new jsPDF();
  const now = new Date();

  // Calculate Start Date
  const startDate = new Date();
  let periodText = '';

  if (period === 'monthly') {
      startDate.setDate(now.getDate() - 30);
      periodText = 'Último Mes';
  } else if (period === 'quarterly') {
      startDate.setDate(now.getDate() - 90);
      periodText = 'Último Trimestre';
  } else if (period === 'annual') {
      startDate.setDate(now.getDate() - 365);
      periodText = 'Último Año';
  }

  // Filter Transactions
  const reportTransactions = transactions.filter(t => {
      const txDate = new Date(t.dateBorrowed);
      return t.userId === user.id && txDate >= startDate;
  }).sort((a,b) => new Date(b.dateBorrowed).getTime() - new Date(a.dateBorrowed).getTime());

  // --- HEADER ---

  // Logo (Top Right)
  if (logoUrl) {
      try {
        // Logo at x=170, y=10, w=25, h=25 (approx)
        // Note: Image format must be detected or specified.
        // If logoUrl is a data URI (base64), jsPDF detects it.
        // If it's a URL, it might fail without CORS.
        doc.addImage(logoUrl, 170, 10, 25, 25);
      } catch (e) {
          console.warn('Could not add logo to PDF', e);
      }
  }

  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.text(schoolName, 14, 22);

  doc.setFontSize(14);
  doc.text('Informe de Préstamos', 14, 32);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Alumno: ${user.firstName} ${user.lastName}`, 14, 42);
  doc.text(`Clase: ${user.className}`, 14, 47);
  doc.text(`Periodo: ${periodText}`, 14, 52);
  doc.text(`Fecha de emisión: ${now.toLocaleDateString()}`, 14, 57);

  // --- TABLE ---

  const tableData = reportTransactions.map(tx => {
      const book = books.find(b => b.id === tx.bookId);
      const borrowed = new Date(tx.dateBorrowed).toLocaleDateString();
      const returned = tx.active ? 'Pendiente' : (tx.dateReturned ? new Date(tx.dateReturned).toLocaleDateString() : '-');
      const due = tx.dueDate ? new Date(tx.dueDate).toLocaleDateString() : '-';

      return [
          book ? book.title : 'Libro desconocido',
          borrowed,
          returned,
          due
      ];
  });

  if (tableData.length === 0) {
      doc.text("No hay préstamos registrados en este periodo.", 14, 75);
  } else {
      autoTable(doc, {
          startY: 65,
          head: [['Título del Libro', 'Fecha Préstamo', 'Fecha Devolución', 'Vencimiento']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [79, 70, 229] }, // Indigo-600 like brand
          styles: { fontSize: 9 },
      });
  }

  // Summary
  const activeCount = reportTransactions.filter(t => t.active).length;
  const returnedCount = reportTransactions.length - activeCount;

  const finalY = (doc as any).lastAutoTable?.finalY || 75;

  doc.setFontSize(10);
  doc.setTextColor(40);
  doc.text(`Resumen: ${reportTransactions.length} préstamos en total (${activeCount} pendientes, ${returnedCount} devueltos).`, 14, finalY + 10);

  doc.save(`Reporte_Prestamos_${user.firstName}_${user.lastName}.pdf`);
};
