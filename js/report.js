
// PDF Generation Logic
// Depends on jspdf and jspdf-autotable being loaded globally via CDN in dashboard.html

export function generatePDF(type, data, userProfile, dateRange) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text("Logia Attendance Report", 14, 20);

    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Reporting Period: ${new Date().toLocaleDateString('default', { month: 'long', year: 'numeric' })}`, 14, 35);

    if (userProfile) {
        doc.text(`Employee: ${userProfile.full_name} (${userProfile.email})`, 14, 40);
    }

    doc.text(`Type: ${type.toUpperCase()}`, 14, 45);

    // Table Content
    let head = [];
    let body = [];

    if (type === 'raw') {
        head = [['Date', 'Check In', 'Check Out', 'Status', 'Work Hour']];
        body = data.map(row => {
            let duration = '-';
            if (row.check_in_time && row.check_out_time) {
                const start = new Date(row.check_in_time);
                const end = new Date(row.check_out_time);
                const diffMs = end - start;
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                duration = `${hours} Hour ${minutes} Minutes`;
            } else if (row.status === 'Absent' || row.status === 'On Leave') {
                duration = '0 Hour 0 Minutes';
            }

            return [
                new Date(row.date).toLocaleDateString(),
                row.check_in_time ? new Date(row.check_in_time).toLocaleTimeString() : '-',
                row.check_out_time ? new Date(row.check_out_time).toLocaleTimeString() : '-',
                row.status || '-',
                duration
            ];
        });
    } else if (type === 'summary') {
        // For Admin Summary or Employee Summary
        head = [['Employee', 'Total Present', 'Total Late', 'Total Absent', 'Total Work Hours']];

        // Data processing (if not already processed)
        // Assuming 'data' for summary is an array of aggregated objects
        body = data.map(row => [
            row.name,
            row.present,
            row.late,
            row.absent,
            row.totalHours
        ]);
    }

    doc.autoTable({
        startY: 55,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [108, 99, 255] }, // Primary Color
    });

    let fileName = `report_${type}_${Date.now()}.pdf`;
    if (type === 'summary') fileName = 'Summary Report.pdf';
    if (type === 'raw') fileName = 'Full Report.pdf';

    doc.save(fileName);
}
