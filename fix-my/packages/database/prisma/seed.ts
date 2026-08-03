import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
const prisma = new PrismaClient();
const categories = [
  ["plumbing","Faucet","Plomería","Plomberie","Loodgieter","Plumbing","Canalização"],
  ["repairs","Wrench","Reparaciones","Réparations","Reparaties","Repairs","Reparações"],
  ["cleaning","Sparkles","Limpieza","Nettoyage","Schoonmaak","Cleaning","Limpeza"],
  ["moving","Truck","Mudanzas","Déménagement","Verhuizen","Moving","Mudanças"],
  ["tech","Monitor","Soporte técnico","Support technique","Technische hulp","Tech support","Suporte técnico"],
  ["locksmith","Key","Cerrajería","Serrurerie","Slotenmaker","Locksmith","Serralharia"],
] as const;
async function main(){for(const[slug,icon,nameEs,nameFr,nameNl,nameEn,namePt]of categories)await prisma.serviceCategory.upsert({where:{slug},update:{icon,nameEs,nameFr,nameNl,nameEn,namePt},create:{slug,icon,nameEs,nameFr,nameNl,nameEn,namePt,description:nameEs}});await prisma.user.upsert({where:{email:"admin@fixmy.local"},update:{passwordHash:await hash("Admin123!",12)},create:{name:"Louis Admin",email:"admin@fixmy.local",passwordHash:await hash("Admin123!",12),role:"ADMIN"}});const mock=await prisma.paymentProvider.findFirst({where:{type:"MOCK"}});if(mock){await prisma.paymentProvider.update({where:{id:mock.id},data:{name:"Pago de prueba FIX MY",supportedMethods:["mock_card","mock_bancontact"],mode:"test",isActive:true,priority:100}})}else{await prisma.paymentProvider.create({data:{type:"MOCK",name:"Pago de prueba FIX MY",supportedMethods:["mock_card","mock_bancontact"],mode:"test",isActive:true,priority:100}})}}
main().finally(()=>prisma.$disconnect());
