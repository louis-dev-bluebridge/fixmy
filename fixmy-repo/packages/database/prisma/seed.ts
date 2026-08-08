import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const categories = [
  ["home","Home","Hogar","Maison","Woning","Home","Casa","Ayuda general para el hogar"],
  ["repairs","Wrench","Reparaciones","Réparations","Reparaties","Repairs","Reparações","Reparaciones y mantenimiento"],
  ["cleaning","Sparkles","Limpieza","Nettoyage","Schoonmaak","Cleaning","Limpeza","Limpieza profesional"],
  ["moving","Truck","Mudanzas","Déménagement","Verhuizen","Moving","Mudanças","Mudanzas y transporte"],
  ["tech","Monitor","Soporte técnico","Support technique","Technische hulp","Tech support","Suporte técnico","Ayuda con tecnología"],
  ["plumbing","Faucet","Fontanería","Plomberie","Loodgieter","Plumbing","Canalização","Fontanería y fugas"],
] as const;

async function main(){
  const categoryIds:Record<string,string>={};
  for(const[slug,icon,nameEs,nameFr,nameNl,nameEn,namePt,description]of categories){
    const category=await prisma.serviceCategory.upsert({where:{slug},update:{icon,nameEs,nameFr,nameNl,nameEn,namePt,description,isActive:true},create:{slug,icon,nameEs,nameFr,nameNl,nameEn,namePt,description,isActive:true}});
    categoryIds[slug]=category.id;
  }

  const adminPassword=await hash("Admin123!",12);
  const clientPassword=await hash("Client123!",12);
  const proPassword=await hash("Pro123!",12);
  await prisma.user.upsert({where:{email:"admin@fixmy.demo"},update:{name:"FIX MY Admin",passwordHash:adminPassword,role:"ADMIN",status:"ACTIVE"},create:{name:"FIX MY Admin",email:"admin@fixmy.demo",passwordHash:adminPassword,role:"ADMIN"}});
  await prisma.user.upsert({where:{email:"admin@fixmy.local"},update:{passwordHash:adminPassword,status:"ACTIVE"},create:{name:"FIX MY Admin",email:"admin@fixmy.local",passwordHash:adminPassword,role:"ADMIN"}});
  const client=await prisma.user.upsert({where:{email:"client@fixmy.demo"},update:{name:"Sophie Demo",passwordHash:clientPassword,status:"ACTIVE"},create:{name:"Sophie Demo",email:"client@fixmy.demo",passwordHash:clientPassword,role:"CLIENT",client:{create:{}}}});
  await prisma.clientProfile.upsert({where:{userId:client.id},update:{},create:{userId:client.id}});
  const pro=await prisma.user.upsert({where:{email:"pro@fixmy.demo"},update:{name:"John Demo",passwordHash:proPassword,status:"ACTIVE"},create:{name:"John Demo",email:"pro@fixmy.demo",passwordHash:proPassword,role:"PRO"}});
  await prisma.proProfile.upsert({where:{userId:pro.id},update:{profession:"Plumber",businessName:"John Home Services",bio:"Verified Brussels plumbing and home repair specialist.",phone:"+32 470 00 00 00",serviceArea:"Brussels",serviceRadiusKm:30,hourlyRateCents:5500,yearsExperience:9,approvalStatus:"APPROVED",rating:4.9,isOnline:true,latitude:50.8503,longitude:4.3517},create:{userId:pro.id,profession:"Plumber",businessName:"John Home Services",bio:"Verified Brussels plumbing and home repair specialist.",phone:"+32 470 00 00 00",serviceArea:"Brussels",serviceRadiusKm:30,hourlyRateCents:5500,yearsExperience:9,approvalStatus:"APPROVED",rating:4.9,isOnline:true,latitude:50.8503,longitude:4.3517}});
  for(const slug of ["plumbing","repairs","home"]){await prisma.proService.upsert({where:{proId_categoryId:{proId:pro.id,categoryId:categoryIds[slug]!}},update:{},create:{proId:pro.id,categoryId:categoryIds[slug]!}})}

  let mock=await prisma.paymentProvider.findFirst({where:{type:"MOCK"}});
  mock=mock?await prisma.paymentProvider.update({where:{id:mock.id},data:{name:"FIX MY Demo Payment",supportedMethods:["mock_card","mock_bancontact"],mode:"test",isActive:true,priority:100}}):await prisma.paymentProvider.create({data:{type:"MOCK",name:"FIX MY Demo Payment",supportedMethods:["mock_card","mock_bancontact"],mode:"test",isActive:true,priority:100}});

  const existing=await prisma.job.findFirst({where:{clientId:client.id,title:"Leaky Faucet — Demo"}});
  const job=existing?await prisma.job.update({where:{id:existing.id},data:{assignedProId:pro.id,categoryId:categoryIds.plumbing!,description:"Kitchen faucet is leaking continuously. Demo request for VPS validation.",address:"Rue de la Loi 1, 1000 Brussels",budgetCents:8500,status:"PRO_EN_ROUTE",latitude:50.8467,longitude:4.3525,etaMinutes:18}}):await prisma.job.create({data:{clientId:client.id,assignedProId:pro.id,categoryId:categoryIds.plumbing!,title:"Leaky Faucet — Demo",description:"Kitchen faucet is leaking continuously. Demo request for VPS validation.",address:"Rue de la Loi 1, 1000 Brussels",budgetCents:8500,status:"PRO_EN_ROUTE",latitude:50.8467,longitude:4.3525,etaMinutes:18}});
  await prisma.payment.upsert({where:{idempotencyKey:"seed:demo-leaky-faucet"},update:{jobId:job.id,providerId:mock.id,status:"SUCCEEDED",amountCents:8500,paidAt:new Date(),method:"mock_bancontact"},create:{jobId:job.id,providerId:mock.id,method:"mock_bancontact",status:"SUCCEEDED",amountCents:8500,idempotencyKey:"seed:demo-leaky-faucet",externalReference:"DEMO-PAID",paidAt:new Date()}});
  const history=await prisma.jobHistory.count({where:{jobId:job.id}});
  if(!history){for(const status of ["DRAFT","PAYMENT_PENDING","OPEN"] as const)await prisma.jobHistory.create({data:{jobId:job.id,actorId:client.id,status}});for(const status of ["ASSIGNED","PRO_EN_ROUTE"] as const)await prisma.jobHistory.create({data:{jobId:job.id,actorId:pro.id,status}})}
  await prisma.activityLog.upsert({where:{id:"00000000-0000-4000-8000-000000000001"},update:{summary:"Demo marketplace is ready for testing"},create:{id:"00000000-0000-4000-8000-000000000001",actorId:pro.id,action:"DEMO_READY",entityType:"JOB",entityId:job.id,summary:"Demo marketplace is ready for testing",metadata:{seed:true}}});
  await prisma.systemLog.upsert({where:{id:"00000000-0000-4000-8000-000000000002"},update:{message:"Demo API startup log"},create:{id:"00000000-0000-4000-8000-000000000002",level:"INFO",source:"seed",message:"Demo API startup log",path:"/health",statusCode:200,requestId:"demo-seed"}});
  console.log("FIX MY demo data ready: admin@fixmy.demo / Admin123!, client@fixmy.demo / Client123!, pro@fixmy.demo / Pro123!");
}

main().finally(()=>prisma.$disconnect());
