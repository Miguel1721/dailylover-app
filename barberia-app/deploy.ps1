$Server = "ubuntu@157.137.232.7"
$Key = "C:\Users\jeloz\.ssh\llave_server_149"
$RemoteDir = "/home/ubuntu/PRODUCCION/barberia"
$TarFile = "barberia_deploy.tar.gz"

Write-Host "Iniciando deploy a VPS..."
tar -czf $TarFile --exclude='node_modules' --exclude='.next' --exclude='.git' .
ssh -i $Key -o StrictHostKeyChecking=no $Server "mkdir -p $RemoteDir"
scp -i $Key -o StrictHostKeyChecking=no $TarFile "${Server}:${RemoteDir}/"
$Cmd = "cd $RemoteDir; tar -xzf $TarFile; rm -f $TarFile; docker compose -p barberia-app up -d --build --no-deps barberia-app; sleep 3; docker compose -p barberia-app exec -T barberia-app npx prisma db push; docker compose -p barberia-app exec -T barberia-app node prisma/seed.js"
ssh -i $Key -o StrictHostKeyChecking=no $Server $Cmd
Remove-Item -Path $TarFile -ErrorAction SilentlyContinue
Write-Host "Deploy completado exitosamente!"
