Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath
' Ejecutar node server.js en segundo plano (0 = ventana invisible, False = no esperar)
WshShell.Run "node server.js", 0, False
