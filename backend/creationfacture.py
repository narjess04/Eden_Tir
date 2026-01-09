import io
import os
import qrcode
from supabase import create_client, Client
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader, PdfWriter
from num2words import num2words 

# ===================== CONFIGURATION SUPABASE =====================
SUPABASE_URL = "https://qsuagjwscgsftgfyfket.supabase.co/"
# Note: Attention à ne pas exposer tes clés secrètes publiquement
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzdWFnandzY2dzZnRnZnlma2V0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzUyODg3NywiZXhwIjoyMDgzMTA0ODc3fQ.Vn6QwgR7MY_MaXAC8FLmFU7Pk65rY-x_aIu8TLOKW58"
BUCKET_NAME = "Facture"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ===================== FONCTIONS DE STOCKAGE =====================
def upload_to_supabase(pdf_bytes, filename):
    try:
        # On utilise directement upsert=True pour simplifier
        supabase.storage.from_(BUCKET_NAME).upload(
            path=filename,
            file=pdf_bytes,
            file_options={"content-type": "application/pdf", "x-upsert": "true"}
        )
    except Exception as e:
        try:
            supabase.storage.from_(BUCKET_NAME).update(
                path=filename,
                file=pdf_bytes,
                file_options={"content-type": "application/pdf"}
            )
        except Exception as e2:
            return {"success": False, "error": str(e2)}
    
    url_res = supabase.storage.from_(BUCKET_NAME).get_public_url(filename)
    return {"success": True, "url": url_res}
    
def montant_en_lettres(montant):
    entier = int(montant)
    millimes = int(round((montant - entier) * 1000))
    
    texte_entier = num2words(entier, lang='fr').capitalize()
    
    if millimes > 0:
        texte_millimes = num2words(millimes, lang='fr')
        return f"{texte_entier} dinars et {texte_millimes} millimes"
    return f"{texte_entier} dinars"

def generer_facture_eden_dynamique(fichier_entete, data):
    try:
        f_num = data['facture'].get('numero', 'FACT-001')
        nom_fichier = f"facture_{f_num}.pdf"
        
        url_cible = f"{SUPABASE_URL}storage/v1/object/public/{BUCKET_NAME}/{nom_fichier}"

        packet = io.BytesIO()
        c = canvas.Canvas(packet, pagesize=A4)
        
        qr = qrcode.QRCode(box_size=3, border=1)
        qr.add_data(url_cible)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")
        qr_buf = io.BytesIO()
        qr_img.save(qr_buf, format="PNG")
        qr_buf.seek(0)
        c.drawImage(ImageReader(qr_buf), 10*mm, A4[1]-40*mm, width=30*mm, height=30*mm)

        c.setFont("Helvetica", 9)
        y_client = 255*mm 
        client = data['client']
        c.drawRightString(185*mm, y_client, f"Code client : {client.get('code_client', '')}")
        c.drawRightString(185*mm, y_client - 5*mm, f"Client : {client.get('nom', '')}")
        c.drawRightString(185*mm, y_client - 10*mm, f"Adresse : {client.get('adresse', '')}")
        c.drawRightString(185*mm, y_client - 15*mm, f"Code TVA : {client.get('code_tva', '')}")

        y_info = 218*mm 
        f = data['facture']
        
        c.setFont("Helvetica-Bold", 8.5)
        labels_gauche = ["Facture n° :", "Date Facture :", "Dossier import n° :", "Navire :", "Date d'arrivée :", "Conteneur :" , "Marque"]
        values_gauche = [f.get('numero'), f.get('date', '')[:10], f.get('dossier_no'), f.get('navire'), f.get('date_arrivee'), f.get('conteneur'), f.get('marque')]
        
        for i, (label, val) in enumerate(zip(labels_gauche, values_gauche)):
            c.setFont("Helvetica-Bold", 8.5)
            c.drawString(25*mm, y_info - (i*4.5)*mm, label)
            c.setFont("Helvetica", 8.5)
            c.drawString(60*mm, y_info - (i*4.5)*mm, str(val))

        labels_droite = ["Déclaration C n° :", "Déclaration UC n° :", "Escale n° :", "Rubrique :", "Colisage :", "Poids Brut :", "Valeur Douane :"]
        values_droite = [f.get('declaration_c'), f.get('declaration_uc'), f.get('escale'), f.get('rubrique'), f.get('colisage'), f.get('poids_brut') , f.get('valeur_douane')]

        for i, (label, val) in enumerate(zip(labels_droite, values_droite)):
            c.setFont("Helvetica-Bold", 8.5)
            c.drawString(115*mm, y_info - (i*4.5)*mm, label)
            c.setFont("Helvetica", 8.5)
            c.drawString(155*mm, y_info - (i*4.5)*mm, str(val))

        def draw_section_lines(title, items, y_start):
            if not items: return y_start
            c.setFont("Helvetica-Bold", 9.5)
            c.drawString(25*mm, y_start, title)
            c.line(25*mm, y_start-1*mm, 45*mm, y_start-1*mm)
            
            curr_y = y_start - 6*mm
            c.setFont("Helvetica", 9)
            for item in items:
                if curr_y < 40*mm: break 
                c.drawString(25*mm, curr_y, item['label'])
                c.drawRightString(185*mm, curr_y, f"{item['montant']:.3f}")
                curr_y -= 4.5*mm
            return curr_y - 3*mm

        y_current = 182*mm
        y_current = draw_section_lines("DEBOURS", data['lignes'].get('debours', []), y_current)
        y_current = draw_section_lines("TRANSIT", data['lignes'].get('transit', []), y_current)
        y_current = draw_section_lines("TRANSPORT", data['lignes'].get('transport', []), y_current)

        t = data['totaux']
        y_tot = y_current - 10*mm
    
        totaux_labels = [
            ("Total non Taxable :", t.get('total_non_taxable', 0)),
            ("Total Taxables :", t.get('total_taxable', 0)),
            ("TVA 7% :", t.get('tva_7', 0)),
            ("TVA 19% :", t.get('tva_19', 0)),
            ("Timbre Fiscal :", t.get('timbre', 0))
        ]
    
        c.setFont("Helvetica", 9.5)
        for label, val in totaux_labels:
            c.drawString(115*mm, y_tot, label)
            c.drawRightString(185*mm, y_tot, f"{val:.3f}")
            y_tot -= 5*mm
    
        c.setFont("Helvetica-Bold", 11)
        c.drawString(115*mm, y_tot - 2*mm, "Total Facture en TND")
        c.drawRightString(185*mm, y_tot - 2*mm, f"{t.get('total_final', 0):.3f}")

     
        y_footer = y_tot - 15*mm
        c.setFont("Helvetica-Oblique", 9.5)
        c.drawString(25*mm, y_footer, "Total en votre aimable règlement :")
    
        texte_lettres = montant_en_lettres(t.get('total_final', 0))
        c.setFont("Helvetica", 10)
        c.drawString(25*mm, y_footer - 6*mm, f"{texte_lettres}")
        
        c.save()
        packet.seek(0)

        if not os.path.exists(fichier_entete):
            return {"success": False, "error": f"Fichier {fichier_entete} absent"}

        base_pdf = PdfReader(open(fichier_entete, "rb"))
        base_page = base_pdf.pages[0]
        
        overlay_pdf = PdfReader(packet)
        base_page.merge_page(overlay_pdf.pages[0])
        
        writer = PdfWriter()
        writer.add_page(base_page)
        
        output = io.BytesIO()
        writer.write(output)
        upload_to_supabase(output.getvalue(), nom_fichier)
        output.seek(0)
        
        return output

    except Exception as e:
        print(f"Erreur génération : {e}")
        return None

