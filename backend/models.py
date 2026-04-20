from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Pasien(Base):
    __tablename__ = "pasien"
    
    id_pasien = Column(Integer, primary_key=True, index=True)
    no_rm = Column(String, unique=True, index=True)
    nama_pasien = Column(String)

    # Relasi ke tabel pemeriksaan
    pemeriksaan = relationship("Pemeriksaan", back_populates="pasien")


class Jenis(Base):
    __tablename__ = "jenis"
    
    id_jenis = Column(Integer, primary_key=True, index=True)
    nama_jenis = Column(String)

    # Relasi ke tabel analisis
    analisis = relationship("Analisis", back_populates="jenis")


class Pemeriksaan(Base):
    __tablename__ = "pemeriksaan"
    
    id_pemeriksaan = Column(Integer, primary_key=True, index=True)
    id_pasien = Column(Integer, ForeignKey("pasien.id_pasien"))
    no_reg = Column(String, index=True)
    tgl_pemeriksaan = Column(DateTime, default=datetime.utcnow)
    id_dokter = Column(Integer)
    hasil_akhir_pdf = Column(String, nullable=True) # Path ke file PDF

    pasien = relationship("Pasien", back_populates="pemeriksaan")
    analisis = relationship("Analisis", back_populates="pemeriksaan")


class Analisis(Base):
    __tablename__ = "analisis"
    
    id_analisis = Column(Integer, primary_key=True, index=True)
    id_pemeriksaan = Column(Integer, ForeignKey("pemeriksaan.id_pemeriksaan"))
    id_jenis = Column(Integer, ForeignKey("jenis.id_jenis"))
    
    gambar_asli = Column(String) # Path file gambar
    gambar_hasil = Column(String, nullable=True) # Path file segmentasi
    teks_hasil_analisis = Column(Text, nullable=True) # JSON AI Result
    doctor_notes = Column(Text, nullable=True)  # Simpan JSON Catatan Dokter
    doctor_bboxes = Column(Text, nullable=True) # Simpan JSON Kotak Hijau Dokter
    hasil_pdf = Column(String, nullable=True)
    status = Column(String, default="Selesai")
    created_at = Column(DateTime, default=datetime.utcnow)

    pemeriksaan = relationship("Pemeriksaan", back_populates="analisis")
    jenis = relationship("Jenis", back_populates="analisis")