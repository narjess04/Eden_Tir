from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from pypdf import PdfReader, PdfWriter
from num2words import num2words
import qrcode
import io

def montant_en_lettres(montant):
    entier = int(montant)
    millimes = int(round((montant - entier) * 1000))
    
    texte_entier = num2words(entier, lang='fr').capitalize()
    
    if millimes > 0:
        texte_millimes = num2words(millimes, lang='fr')
        return f"{texte_entier} dinars et {texte_millimes} millimes"
    return f"{texte_entier} dinars"

def generer_facture_eden_dynamique(fichier_entete, data):
    packet = io.BytesIO()
    c = canvas.Canvas(packet, pagesize=A4)

    
    # --- 2. BLOC CLIENT (HAUT DROITE) ---
    c.setFont("Helvetica", 9)
    y_client = 255*mm 
    client = data['client']
    c.drawRightString(185*mm, y_client, f"Code client {client['code_client']}")
    c.drawRightString(185*mm, y_client - 5*mm, f"Client : {client['nom']}")
    c.drawRightString(185*mm, y_client - 10*mm, f"Adresse : {client['adresse']}")
    c.drawRightString(185*mm, y_client - 15*mm, f"Code TVA : {client['code_tva']}")

    # --- 3. INFOS DOSSIER (DEUX COLONNES) ---
    y_info = 218*mm 
    f = data['facture']
    
    # Colonne 1 (Gauche)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(25*mm, y_info, "Facture n° :")
    c.drawString(25*mm, y_info - 4.5*mm, "Date Facture :")
    c.drawString(25*mm, y_info - 9*mm, "Dossier import n° :")
    c.drawString(25*mm, y_info - 13.5*mm, "Navire :")
    c.drawString(25*mm, y_info - 18*mm, "Date d'arrivée :")
    c.drawString(25*mm, y_info - 22.5*mm, "Conteneur :")
    
    c.setFont("Helvetica", 8.5)
    c.drawString(60*mm, y_info, str(f['numero']))
    c.drawString(60*mm, y_info - 4.5*mm, str(f['date'][:10]))
    c.drawString(60*mm, y_info - 9*mm, str(f['dossier_no']))
    c.drawString(60*mm, y_info - 13.5*mm, str(f['navire']))
    c.drawString(60*mm, y_info - 18*mm, str(f['date_arrivee']))
    c.drawString(60*mm, y_info - 22.5*mm, str(f['conteneur']))

    # Colonne 2 (Droite)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(115*mm, y_info, "Déclaration C n° :")
    c.drawString(115*mm, y_info - 4.5*mm, "Déclaration UC n° :")
    c.drawString(115*mm, y_info - 9*mm, "Escale n° :")
    c.drawString(115*mm, y_info - 13.5*mm, "Rubrique :")
    c.drawString(115*mm, y_info - 18*mm, "Colisage :")
    c.drawString(115*mm, y_info - 22.5*mm, "Poids Brut :")
    
    c.setFont("Helvetica", 8.5)
    c.drawString(155*mm, y_info, str(f['declaration_c']))
    c.drawString(155*mm, y_info - 4.5*mm, str(f['declaration_uc']))
    c.drawString(155*mm, y_info - 9*mm, str(f['escale']))
    c.drawString(155*mm, y_info - 13.5*mm, str(f['rubrique']))
    c.drawString(155*mm, y_info - 18*mm, str(f['colisage']))
    c.drawString(155*mm, y_info - 22.5*mm, str(f['poids_brut']))

    # --- 4. FONCTION POUR DESSINER LES LIGNES DYNAMIQUEMENT ---
    def draw_section_lines(title, items, y_start):
        if not items: return y_start
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(25*mm, y_start, title)
        c.line(25*mm, y_start-1*mm, 45*mm, y_start-1*mm)
        
        curr_y = y_start - 6*mm
        c.setFont("Helvetica", 9)
        for item in items:
            c.drawString(25*mm, curr_y, item['label'])
            c.drawRightString(185*mm, curr_y, f"{item['montant']:.3f}")
            curr_y -= 4.5*mm
        return curr_y - 3*mm

    # --- GÉNÉRATION DES SECTIONS ---
    y_current = 182*mm
    y_current = draw_section_lines("DEBOURS", data['lignes']['debours'], y_current)
    y_current = draw_section_lines("TRANSIT", data['lignes']['transit'], y_current)
    y_current = draw_section_lines("TRANSPORT", data['lignes']['transport'], y_current)

    # --- 5. BLOC TOTAUX ---
    t = data['totaux']
    y_tot = y_current - 10*mm
    
    totaux_labels = [
        ("Total non Taxable :", t['total_non_taxable']),
        ("Total Taxables :", t['total_taxable']),
        ("TVA 7% :", t['tva_7']),
        ("TVA 19% :", t['tva_19']),
        ("Timbre Fiscal :", t['timbre'])
    ]
    
    c.setFont("Helvetica", 9.5)
    for label, val in totaux_labels:
        c.drawString(115*mm, y_tot, label)
        c.drawRightString(185*mm, y_tot, f"{val:.3f}")
        y_tot -= 5*mm
    
    # Total Final
    c.setFont("Helvetica-Bold", 11)
    c.drawString(115*mm, y_tot - 2*mm, "Total Facture en TND")
    c.drawRightString(185*mm, y_tot - 2*mm, f"{t['total_final']:.3f}")

    # --- 6. PIED DE PAGE (Légende & Montant en lettres) ---
    y_footer = y_tot - 15*mm
    c.setFont("Helvetica-Oblique", 9.5)
    c.drawString(25*mm, y_footer, "Total en votre aimable règlement :")
    
    # Appel de la fonction de conversion
    texte_lettres = montant_en_lettres(t['total_final'])
    c.setFont("Helvetica", 10)
    c.drawString(25*mm, y_footer - 6*mm, f"{texte_lettres}")

    c.save()
    packet.seek(0)

    # --- 7. FUSION AVEC L'ENTÊTE ---
    # On utilise 'with' pour ouvrir le chemin absolu reçu en paramètre
    try:
        with open(fichier_entete, "rb") as f_entete:
            lecteur = PdfReader(f_entete)
            page = lecteur.pages[0]
            overlay = PdfReader(packet).pages[0]
            page.merge_page(overlay)

            ecrivain = PdfWriter()
            ecrivain.add_page(page)
            
            output = io.BytesIO()
            ecrivain.write(output)
            output.seek(0)
            return output
    except FileNotFoundError:
        print(f"Erreur : Le fichier d'entête est introuvable au chemin : {fichier_entete}")
        raise
