Option Explicit

Dim shell, fileSystem, projectRoot, commandFile
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

projectRoot = fileSystem.GetParentFolderName(WScript.ScriptFullName)
commandFile = fileSystem.BuildPath(projectRoot, "Abrir-Verbo-Web.cmd")
shell.Run """" & commandFile & """", 0, False
